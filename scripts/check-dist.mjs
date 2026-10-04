import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { inspectImage } from './lib/image-meta.mjs';
import { sha256, variantIndex } from './lib/photo-store.mjs';
import { ORIGIN, counterpartErrors, pagePath } from './lib/counterparts.mjs';
import { manifest } from './lib/map-store.mjs';
import { securityTxtErrors } from './lib/security-txt.mjs';
import { xmlErrors } from './lib/xml.mjs';
import { pending } from '../src/i18n/pending.ts';

const args = process.argv.slice(2);
const dist = args.find((a) => !a.startsWith('--')) ?? 'dist';
const complete = args.includes('--complete');
const FILE_LIMIT = 20000;
const files = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? files(join(dir, e.name)) : [join(dir, e.name)],
  );
const all = files(dist);
const errors = [];
const fail = (file, msg) => errors.push(`${relative(dist, file)}: ${msg}`);

const resolves = (path) => {
  const p = decodeURI(path.split(/[?#]/)[0]);
  const base = join(dist, p);
  return [base, join(base, 'index.html'), `${base}.html`].some((f) => existsSync(f) && statSync(f).isFile());
};

const pages = new Map();
const tileRoots = new Set();
for (const file of all.filter((f) => f.endsWith('.html'))) {
  const html = readFileSync(file, 'utf8');
  const page = pagePath(relative(dist, file));
  if (page) pages.set(page, html);

  for (const [tag, attrs, body] of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    if (/\ssrc=/i.test(attrs)) continue;
    if (!/^\s*type="application\/ld\+json"\s*$/i.test(attrs)) {
      fail(file, `inline script: ${tag.slice(0, 80)}`);
      continue;
    }
    if (/[<>]/.test(body)) fail(file, 'JSON-LD contains an unescaped < or >');
    try {
      JSON.parse(body);
    } catch {
      fail(file, 'JSON-LD is not valid JSON');
    }
  }
  if (/<style\b/i.test(html)) fail(file, 'inline <style>');
  if (/<[^>]+\sstyle=/i.test(html)) fail(file, 'style="" attribute');

  const loads = [
    ...html.matchAll(/<(?:script|img|source|iframe|audio|video|embed)\b[^>]*\ssrc="([^"]*)"/gi),
    ...[...html.matchAll(/<link\b([^>]*)>/gi)]
      .filter(([, attrs]) => /\srel="(stylesheet|preload|modulepreload|icon|apple-touch-icon|manifest)"/i.test(attrs))
      .map(([, attrs]) => /\shref="([^"]*)"/i.exec(attrs) ?? [, '']),
  ]
    .map((m) => m[1])
    .concat([...html.matchAll(/\ssrcset="([^"]*)"/gi)].flatMap((m) => m[1].split(',').map((c) => c.trim().split(/\s+/)[0])));
  for (const url of loads) {
    if (/^(https?:)?\/\//i.test(url) || /^data:/i.test(url)) fail(file, `external or data: resource: ${url}`);
    else if (url.startsWith('/') && !resolves(url)) fail(file, `missing resource: ${url}`);
  }

  for (const [, href] of html.matchAll(/<a\b[^>]*\shref="([^"]*)"/gi)) {
    if (href.startsWith('/') && !href.startsWith('//') && !resolves(href)) fail(file, `broken link: ${href}`);
  }

  for (const [, tiles] of html.matchAll(/\sdata-tiles="([^"{]*)/gi)) tileRoots.add(tiles);

  for (const [, image] of html.matchAll(/<meta\s+property="og:image"\s+content="([^"]*)"/gi)) {
    if (!image.startsWith(`${ORIGIN}/`) || !resolves(new URL(image).pathname)) fail(file, `og:image not in the build: ${image}`);
  }
}

for (const e of counterpartErrors(pages, pending, { complete })) errors.push(e);

const securityTxt = join(dist, '.well-known', 'security.txt');
if (!existsSync(securityTxt)) errors.push('.well-known/security.txt is missing');
else for (const e of securityTxtErrors(readFileSync(securityTxt, 'utf8'))) fail(securityTxt, e);

const feeds = all.filter((f) => f.endsWith('rss.xml'));
for (const file of feeds) {
  const xml = readFileSync(file, 'utf8');
  for (const e of xmlErrors(xml)) fail(file, `XML: ${e}`);
  const text = xml.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
  for (const [, attr] of text.matchAll(/\s(?:href|src)="([^"]*)"/g)) {
    if (!/^[a-z][a-z0-9+.-]*:/i.test(attr)) fail(file, `relative URL in the feed: ${attr}`);
  }
  for (const [url] of text.matchAll(new RegExp(`${ORIGIN.replace(/\./g, '\\.')}/[^\\s"<>]*`, 'g'))) {
    if (!resolves(new URL(url).pathname)) fail(file, `feed links outside the build: ${url}`);
  }
}

for (const file of all.filter((f) => f.endsWith('.css'))) {
  for (const [, url] of readFileSync(file, 'utf8').matchAll(/url\(\s*['"]?([^'")]+)/gi)) {
    if (/^(https?:)?\/\//i.test(url) || /^data:/i.test(url)) fail(file, `external or data: url(): ${url.slice(0, 60)}`);
  }
}

const images = all.filter((f) => relative(dist, f).startsWith('img/'));
if (images.length) {
  const known = variantIndex();
  for (const file of images) {
    const name = relative(join(dist, 'img'), file);
    const v = known.get(name);
    const buf = readFileSync(file);
    if (!v) fail(file, 'image not listed in the photo data');
    else if (sha256(buf) !== v.sha256) fail(file, 'SHA-256 does not match the photo data');
    const check = inspectImage(buf);
    if (!check.ok) fail(file, `metadata check: ${check.errors.join('; ')}`);
  }
}

if (all.length > FILE_LIMIT) errors.push(`${all.length} files, the Workers static assets limit is ${FILE_LIMIT}`);

const map = manifest();
for (const root of tileRoots) {
  const tiles = all.filter((f) => `/${relative(dist, f)}`.startsWith(root)).length;
  if (!map || tiles !== map.tiles) errors.push(`${root}: ${tiles} map tiles in the build, the map data lists ${map?.tiles ?? 'none'}`);
}

if (errors.length) {
  console.error(errors.map((e) => `✗ ${e}`).join('\n'));
  console.error(`\n${errors.length} problem(s) in ${dist}/`);
  process.exit(1);
}
console.log(`✓ ${dist}/: ${all.length} of ${FILE_LIMIT} files, ${tileRoots.size ? `${map.tiles} map tiles, ` : ''}no inline code, no external resources, no broken links, ${images.length} photo variants verified`);
console.log(`✓ ${feeds.length} feeds well-formed, security.txt current`);
console.log(`✓ ${pages.size} pages, every language has its counterpart${pending.length ? ` (${pending.length} translation(s) pending)` : ''}`);
