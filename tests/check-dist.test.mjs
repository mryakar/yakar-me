import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

function run(files) {
  const dir = mkdtempSync(join(tmpdir(), 'dist-'));
  for (const [path, body] of Object.entries(files)) {
    mkdirSync(join(dir, path, '..'), { recursive: true });
    writeFileSync(join(dir, path), body);
  }
  const r = spawnSync('node', ['scripts/check-dist.mjs', dir], { encoding: 'utf8' });
  return { code: r.status, out: r.stdout + r.stderr };
}
const page = (head = '', body = '') => `<!doctype html><html><head>${head}</head><body>${body}</body></html>`;
const ok = {
  'index.html': page('<link rel="stylesheet" href="/_astro/a.css"><link rel="canonical" href="https://yakar.me/">', '<a href="/about/">about</a><a href="https://github.com/x">gh</a>'),
  'about/index.html': page(),
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
};
for (const [name, [files, pattern]] of Object.entries(bad)) {
  test(`yakalanır: ${name}`, () => {
    const r = run({ ...ok, ...files });
    assert.equal(r.code, 1, r.out);
    assert.match(r.out, pattern);
  });
}
