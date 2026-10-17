import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { articleCard, homeCard, ogCardHtml, ogImagePathFor, OG_COLORS, titleSize } from '../src/lib/og.ts';
import { PAGE_BACKGROUND } from '../src/lib/theme.ts';
import { frontmatter } from '../scripts/lib/frontmatter.mjs';
import { pngChunks } from '../scripts/lib/png.mjs';

const article = {
  id: 'locks',
  title: 'Explicit Locking in PostgreSQL',
  topic: 'Databases',
  pubDate: new Date('2026-09-16T00:00:00Z'),
};

test('articleCard: konu ve tarih dilinde, küçük harf (Türkçe kuralıyla)', () => {
  assert.equal(articleCard(article, 'en').label, 'databases · 16 sep 2026');
  assert.equal(articleCard(article, 'tr').label, 'veritabanları · 16 eyl 2026');
});

test('ogImagePathFor: aynı kart aynı ad; başlık, tarih ya da dil değişince ad değişir', async () => {
  const en = await ogImagePathFor(articleCard(article, 'en'));
  assert.match(en, /^\/og\/locks-en-[0-9a-f]{8}\.png$/);
  assert.equal(await ogImagePathFor(articleCard(article, 'en')), en);
  assert.notEqual(await ogImagePathFor(articleCard({ ...article, title: 'Other' }, 'en')), en);
  assert.notEqual(await ogImagePathFor(articleCard({ ...article, pubDate: new Date('2026-09-17') }, 'en')), en);
  assert.notEqual(await ogImagePathFor(articleCard(article, 'tr')), en);
});

test('ogCardHtml: başlık kaçırılır, varlık adresleri verilen işlevden', () => {
  const html = ogCardHtml({ ...articleCard(article, 'en'), title: 'A <b> & "c"' }, (p) => `file:///x/${p}`);
  assert.match(html, /<h1>A &lt;b&gt; &amp; &quot;c&quot;<\/h1>/);
  assert.match(html, /url\(file:\/\/\/x\/@fontsource\/instrument-serif/);
  assert.match(html, /<svg [^>]*width="64" height="64" viewBox="0 0 32 32"><rect [^>]*rx="7"/);
  assert.doesNotMatch(html, /<img/);
});

test("homeCard: dilin tagline'ı ve giriş cümlesi, vurgulu kelime italik; ad dile göre", async () => {
  const tr = ogCardHtml(homeCard('tr'), (p) => p);
  assert.match(tr, /<html lang="tr">/);
  assert.match(tr, /mühendis · yazar · gezgin/);
  assert.match(tr, /<h1>Kod, bir saksafon ve hep uzun yoldan <em>dolaşma<\/em> alışkanlığı\.<\/h1>/);
  assert.match(
    tr,
    /font-style:italic;src:url\(@fontsource\/instrument-serif\/files\/instrument-serif-latin-400-italic/,
  );
  assert.match(await ogImagePathFor(homeCard('es')), /^\/og\/home-es-[0-9a-f]{8}\.png$/);
  assert.notEqual(await ogImagePathFor(homeCard('en')), await ogImagePathFor(homeCard('tr')));
});

test('titleSize: uzun başlık küçülür', () => {
  assert.equal(titleSize('x'.repeat(30)), 88);
  assert.equal(titleSize('x'.repeat(50)), 76);
  assert.equal(titleSize('x'.repeat(63)), 66);
});

const css = readFileSync(new URL('../src/styles/global.css', import.meta.url), 'utf8');
const token = (name) => new RegExp(`--yk-${name}: light-dark\\(([^,]+),\\s*([^)]+\\)?)\\);`).exec(css);

test("OG_COLORS: global.css koyu tema token'larıyla aynı", () => {
  for (const name of ['bg', 'text', 'muted', 'faint', 'accent', 'line'])
    assert.equal(OG_COLORS[name], token(name)?.[2].trim(), name);
});

test('PAGE_BACKGROUND: global.css --yk-bg, iki tema', () => {
  const [, light, dark] = token('bg');
  assert.deepEqual(PAGE_BACKGROUND, { light: light.trim(), dark: dark.trim() });
});

test('frontmatter: çift ve tek tırnak, düz değer', () => {
  const data = frontmatter(
    "---\ntitle: \"PostgreSQL'de \\\"Açık\\\"\"\nshort: 'it''s'\npubDate: 2026-09-16\n---\nbody",
  );
  assert.deepEqual(data, { title: 'PostgreSQL\'de "Açık"', short: "it's", pubDate: '2026-09-16' });
});

test('public/og: her görsel yalnız IHDR, IDAT, IEND', () => {
  const dir = new URL('../public/og/', import.meta.url);
  const files = readdirSync(dir);
  assert.ok(files.length > 0);
  for (const f of files)
    assert.deepEqual([...new Set(pngChunks(readFileSync(new URL(f, dir))))].sort(), ['IDAT', 'IEND', 'IHDR'], f);
});
