// Build çıktısı denetimi (CI'da build'den sonra). Başarısızsa yayın yok (OWASP A02, A05, A10).
//  1. Satır içi script, <style> ve style="" yok: CSP 'self' bunları engeller.
//  2. Sayfanın yüklediği her kaynak siteden: dış alan adı ve data: URI yok.
//  3. Site içi her bağlantı dist/'te bir dosyaya çıkar: kırık bağlantı yok.
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

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

  for (const [tag, attrs] of html.matchAll(/<script\b([^>]*)>/gi)) {
    if (!/\ssrc=/i.test(attrs)) fail(file, `inline script: ${tag.slice(0, 80)}`);
  }
  if (/<style\b/i.test(html)) fail(file, 'inline <style>');
  if (/<[^>]+\sstyle=/i.test(html)) fail(file, 'style="" attribute');

  // Tarayıcının kendiliğinden yüklediği kaynaklar
  const loads = [
    ...html.matchAll(/<(?:script|img|source|iframe|audio|video|embed)\b[^>]*\ssrc="([^"]*)"/gi),
    ...html.matchAll(/<link\b[^>]*\shref="([^"]*)"/gi),
    ...html.matchAll(/\ssrcset="([^"]*)"/gi),
  ].map((m) => m[1]);
  for (const url of loads) {
    if (/^(https?:)?\/\//i.test(url) || /^data:/i.test(url)) fail(file, `external or data: resource: ${url}`);
    else if (url.startsWith('/') && !resolves(url)) fail(file, `missing resource: ${url}`);
  }

  // Site içi bağlantılar
  for (const [, href] of html.matchAll(/<a\b[^>]*\shref="([^"]*)"/gi)) {
    if (href.startsWith('/') && !href.startsWith('//') && !resolves(href)) fail(file, `broken link: ${href}`);
  }
}

for (const file of all.filter((f) => f.endsWith('.css'))) {
  for (const [, url] of readFileSync(file, 'utf8').matchAll(/url\(\s*['"]?([^'")]+)/gi)) {
    if (/^(https?:)?\/\//i.test(url) || /^data:/i.test(url)) fail(file, `external or data: url(): ${url.slice(0, 60)}`);
  }
}

if (errors.length) {
  console.error(errors.map((e) => `✗ ${e}`).join('\n'));
  console.error(`\n${errors.length} problem(s) in ${dist}/`);
  process.exit(1);
}
console.log(`✓ ${dist}/: ${all.length} files, no inline code, no external resources, no broken links`);
