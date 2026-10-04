import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

function run(files, ...flags) {
  const dir = mkdtempSync(join(tmpdir(), 'dist-'));
  for (const [path, body] of Object.entries(files)) {
    mkdirSync(join(dir, path, '..'), { recursive: true });
    writeFileSync(join(dir, path), body);
  }
  const r = spawnSync('node', ['scripts/check-dist.mjs', dir, ...flags], { encoding: 'utf8' });
  return { code: r.status, out: r.stdout + r.stderr };
}
const page = (head = '', body = '') => `<!doctype html><html><head>${head}</head><body>${body}</body></html>`;
const alt = (path) =>
  `<link rel="alternate" hreflang="en" href="https://yakar.me${path}"><link rel="alternate" hreflang="tr" href="https://yakar.me/tr${path}"><link rel="alternate" hreflang="x-default" href="https://yakar.me${path}">`;
const inDays = (days) => new Date(Date.now() + days * 864e5).toISOString().replace(/\.\d+Z$/, 'Z');
const securityTxt = (expires) => `Contact: mailto:a@example.com\nExpires: ${expires}\n`;
const feed = (body = '') =>
  `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0"><channel><link>https://yakar.me/</link>${body}</channel></rss>\n`;
const ok = {
  '.well-known/security.txt': securityTxt(inDays(30)),
  'rss.xml': feed('<item><link>https://yakar.me/about/</link><content:encoded>&lt;a href="https://yakar.me/about/#x"&gt;a&lt;/a&gt;</content:encoded></item>'),
  'index.html': page(`<link rel="stylesheet" href="/_astro/a.css"><link rel="canonical" href="https://yakar.me/">${alt('/')}<meta property="og:image" content="https://yakar.me/og.png">`, '<a href="/about/">about</a><a href="https://github.com/x">gh</a><a href="/tr/" hreflang="tr">Türkçe</a>'),
  'about/index.html': page(alt('/about/')),
  'tr/index.html': page(alt('/'), '<a href="/" hreflang="en">English</a>'),
  'tr/about/index.html': page(alt('/about/')),
  '404.html': page(),
  'tr/404.html': page(),
  'og.png': 'x',
  '_astro/a.css': 'body{color:red}',
};

test('temiz çıktı geçer (canonical ve dış <a> serbest)', () => {
  const r = run(ok);
  assert.equal(r.code, 0, r.out);
});

test('kaçırılmış JSON-LD geçer', () => {
  const r = run({ ...ok, 'x.html': page('', '<script type="application/ld+json">{"a":"\\u003c/script\\u003e"}</script>') });
  assert.equal(r.code, 0, r.out);
});

const bad = {
  'satır içi script': [{ 'x.html': page('<script>alert(1)</script>') }, /inline script/],
  '<style>': [{ 'x.html': page('<style>a{}</style>') }, /inline <style>/],
  'style=""': [{ 'x.html': page('', '<p style="color:red">x</p>') }, /style="" attribute/],
  'dış stylesheet': [{ 'x.html': page('<link rel="stylesheet" href="https://cdn.example.com/x.css">') }, /external or data: resource/],
  'dış font ön yüklemesi': [{ 'x.html': page('<link rel="preload" href="https://evil.example/f.woff2" as="font">') }, /external or data: resource/],
  'data: görsel': [{ 'x.html': page('', '<img src="data:image/png;base64,AAA" alt="">') }, /external or data: resource/],
  "CSS'te data: font": [{ '_astro/b.css': '@font-face{src:url(data:font/woff2;base64,AAA)}' }, /external or data: url\(\)/],
  'kırık bağlantı': [{ 'x.html': page('', '<a href="/nope/">x</a>') }, /broken link: \/nope\//],
  'eksik kaynak': [{ 'x.html': page('<script src="/_astro/missing.js"></script>') }, /missing resource/],
  'srcset içinde eksik kaynak': [{ 'x.html': page('', '<img src="/about/" srcset="/img/nope-640.webp 640w, /img/nope-1280.webp 1280w" alt="">') }, /missing resource: \/img\/nope-640\.webp/],
  'JSON-LD dışında tipli satır içi script': [{ 'x.html': page('<script type="module">alert(1)</script>') }, /inline script/],
  'kaçırılmamış < içeren JSON-LD': [{ 'x.html': page('<script type="application/ld+json">{"a":"</b>"}</script>') }, /unescaped/],
  'geçersiz JSON-LD': [{ 'x.html': page('<script type="application/ld+json">{a:1}</script>') }, /not valid JSON/],
  'foto verisinde olmayan görsel': [{ 'img/stray.webp': 'x' }, /not listed in the photo data/],
  'meta veri taraması': [{ 'img/stray.webp': 'x' }, /metadata check/],
  'Türkçe karşılığı eksik sayfa': [{ 'x/index.html': page() }, /\/x\/: no counterpart at \/tr\/x\//],
  'İngilizce karşılığı eksik sayfa': [{ 'tr/y/index.html': page() }, /\/tr\/y\/: no counterpart at \/y\//],
  'karşılık varken hreflang eksik': [{ 'about/index.html': page() }, /\/about\/: hreflang set is \[\], expected \[en, tr, x-default\]/],
  'karşılık yokken hreflang': [{ 'x/index.html': page(alt('/x/')), 'tr/x/index.html': undefined }, /\/x\/: no counterpart[\s\S]*hreflang tr target does not exist/],
  'kırık hreflang hedefi': [{ 'about/index.html': page(alt('/about/').replace('/tr/about/', '/tr/abot/')) }, /hreflang tr target does not exist: https:\/\/yakar\.me\/tr\/abot\//],
  'site dışına hreflang': [{ 'about/index.html': page(alt('/about/').replace('https://yakar.me/tr/', 'https://evil.example/tr/')) }, /points outside the site/],
  'eksik og:image': [{ 'x.html': page('<meta property="og:image" content="https://yakar.me/og-tr.png">') }, /og:image not in the build/],
  'security.txt yok': [{ '.well-known/security.txt': undefined }, /security\.txt is missing/],
  'süresi dolmuş security.txt': [{ '.well-known/security.txt': securityTxt(inDays(-1)) }, /Expires has passed/],
  'bir yıldan uzak security.txt': [{ '.well-known/security.txt': securityTxt(inDays(400)) }, /more than a year away/],
  'bozuk akış XML': [{ 'rss.xml': feed('<item>') }, /rss\.xml: XML: /],
  'akışta göreli adres': [{ 'rss.xml': feed('<description>&lt;img src="/_astro/a.css"&gt;</description>') }, /relative URL in the feed: \/_astro\/a\.css/],
  'akışta build dışı adres': [{ 'tr/rss.xml': feed('<link>https://yakar.me/nope/</link>') }, /feed links outside the build: https:\/\/yakar\.me\/nope\//],
  'dış og:image': [{ 'x.html': page('<meta property="og:image" content="https://evil.example/og.png">') }, /og:image not in the build/],
};
for (const [name, [files, pattern]] of Object.entries(bad)) {
  test(`yakalanır: ${name}`, () => {
    const r = run(Object.fromEntries(Object.entries({ ...ok, ...files }).filter(([, v]) => v !== undefined)));
    assert.equal(r.code, 1, r.out);
    assert.match(r.out, pattern);
  });
}

test('harita sayfası karolara bağlanıp karolar eksikse kırılır', () => {
  const r = run({ ...ok, 'map.html': page('', '<section data-tiles="/tiles/00000000/{z}/{x}/{y}.mvt"></section>') });
  assert.equal(r.code, 1);
  assert.match(r.out, /\/tiles\/00000000\/: 0 map tiles in the build/);
});
