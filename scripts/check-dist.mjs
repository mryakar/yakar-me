import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { inspectImage } from './lib/image-meta.mjs';
import { sha256, variantIndex } from './lib/photo-store.mjs';

const dist = process.argv[2] ?? 'dist';
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

for (const file of all.filter((f) => f.endsWith('.html'))) {
  const html = readFileSync(file, 'utf8');

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

if (errors.length) {
  console.error(errors.map((e) => `✗ ${e}`).join('\n'));
  console.error(`\n${errors.length} problem(s) in ${dist}/`);
  process.exit(1);
}
console.log(`✓ ${dist}/: ${all.length} files, no inline code, no external resources, no broken links, ${images.length} photo variants verified`);
