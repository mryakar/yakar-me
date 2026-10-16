import { test } from 'node:test';
import assert from 'node:assert/strict';
import { markdownToHtml } from 'satteri';
import { noRawHtml, articleBlocks, articleLang, isReferencesHeading, isSummaryHeading, printsHref, tableOfContents } from '../src/lib/markdown.ts';

const render = async (md) => markdownToHtml(md, { mdastPlugins: [noRawHtml], hastPlugins: [articleBlocks] }).html;

test('ham HTML build\'i kırar', async () => {
  await assert.rejects(render('Hello <script>alert(1)</script>'), /Raw HTML is not allowed/);
  await assert.rejects(render('Pid <pid> here'), /Raw HTML is not allowed/);
});

test('kaçırılmış ya da kod içindeki açı ayraçlarına izin var', async () => {
  const html = await render('Pid \\<pid\\> and `<pid>`');
  assert.match(html, /&lt;pid&gt;/);
  assert.doesNotMatch(html, /<pid>/);
});

test('TL;DR başlığı ve listesi tek kutu', async () => {
  const html = await render('## TL;DR\n\n- one\n- two\n\nAfter.\n');
  assert.match(html, /<section class="tldr"><h2[^>]*>TL;DR<\/h2><ul>[\s\S]*one[\s\S]*two[\s\S]*<\/ul><\/section>/);
  assert.match(html, /<p>After\.<\/p>/);
});

test('"Kısaca" (Türkçe "In short") başlığı ve listesi aside; İçindekiler\'e girmez', async () => {
  const html = await render('### Kısaca\n\n- a\n- b\n');
  assert.match(html, /<aside class="in-short"><h3[^>]*>Kısaca<\/h3><ul>[\s\S]*<\/ul><\/aside>/);
  assert.ok(isSummaryHeading(' Kısaca ') && isSummaryHeading('In short') && isSummaryHeading('En resumen'));
  assert.ok(!isSummaryHeading('TL;DR') && !isSummaryHeading('Kısa') && !isSummaryHeading('Resumen'));
});

test('"In short" başlığı ve listesi aside', async () => {
  const html = await render('### In short\n\n- a\n- b\n');
  assert.match(html, /<aside class="in-short"><h3[^>]*>In short<\/h3><ul>[\s\S]*<\/ul><\/aside>/);
});

test('ardından liste gelmeyen TL;DR başlığı olduğu gibi kalır', async () => {
  const html = await render('## TL;DR\n\nJust a paragraph.\n');
  assert.doesNotMatch(html, /class="tldr"/);
});

test('başlıklı görsel figure olur, başlıksız paragraf içinde kalır', async () => {
  const html = await render('![alt text](./a.gif "A caption")\n\n![plain](./b.gif)\n');
  assert.match(html, /<figure><img src="\.\/a\.gif" alt="alt text"><figcaption>A caption<\/figcaption><\/figure>/);
  assert.match(html, /<p><img src="\.\/b\.gif" alt="plain"><\/p>/);
  assert.doesNotMatch(html, /title=/);
});

test('kendi içinde kayan bloklar klavyeyle kaydırılabilir: pre ve table tabindex="0"', async () => {
  assert.match(await render('```sql\nSELECT 1;\n```'), /<pre tabindex="0"/);
  assert.match(await render('| a | b |\n| - | - |\n| 1 | 2 |'), /<table tabindex="0"/);
});

test('tableOfContents: ## ve altındaki ###; "Kısaca" ve ilk ##\'den önceki ### girmez', () => {
  const h = (depth, slug, text = slug) => ({ depth, slug, text });
  const toc = tableOfContents([h(3, 'orphan'), h(2, 'in-short', 'In short'), h(2, 'a'), h(3, 'a1'), h(4, 'deep'), h(3, 'a2'), h(2, 'b')]);
  assert.deepEqual(toc, [
    { slug: 'a', text: 'a', children: [{ slug: 'a1', text: 'a1' }, { slug: 'a2', text: 'a2' }] },
    { slug: 'b', text: 'b', children: [] },
  ]);
});

test('printsHref: dış adres, bağlantı metninde görünmüyorsa', () => {
  assert.ok(printsHref('https://en.wikipedia.org/wiki/MD5', 'MD5:'));
  assert.ok(printsHref('https://github.com/a/b/tree/master/c', 'https://github.com/a/b'));
  assert.ok(!printsHref('https://openjdk.org/jeps/491', ' https://openjdk.org/jeps/491 '));
  assert.ok(!printsHref('#snapshots', 'Snapshots'));
  assert.ok(!printsHref('/writing/', 'Writing'));
  assert.ok(!printsHref('mailto:a@b.c', 'mail'));
});

test('yazdırmada adresi basılacak bağlantı data-print-href taşır, adresi metin olan taşımaz', async () => {
  const html = await render('[MD5](https://en.wikipedia.org/wiki/MD5) and [https://openjdk.org/jeps/491](https://openjdk.org/jeps/491)');
  assert.match(html, /<a href="https:\/\/en\.wikipedia\.org\/wiki\/MD5" data-print-href="">MD5<\/a>/);
  assert.match(html, /<a href="https:\/\/openjdk\.org\/jeps\/491">https/);
});

const article = (file, frontmatter = {}) => async (md) =>
  (await markdownToHtml(md, {
    mdastPlugins: [noRawHtml],
    hastPlugins: [articleBlocks],
    fileURL: new URL(`file:///site/src/content/writing/locks/${file}`),
    data: { astro: { frontmatter } },
  })).html;

test('articleLang: yalnız yazı dosyası; özgünde frontmatter, çeviride dosya adı', () => {
  assert.equal(articleLang('/s/src/content/writing/locks/index.md', 'en'), 'en');
  assert.equal(articleLang('/s/src/content/writing/locks/tr.md', 'en'), 'tr');
  assert.equal(articleLang('/s/src/content/writing/locks/es.md', undefined), 'es');
  assert.equal(articleLang('/s/src/content/writing/locks/de.md', undefined), undefined);
  assert.equal(articleLang('/s/src/content/photos/hanoi/index.md', 'en'), undefined);
  assert.equal(articleLang('/s/src/content/pages/about/en.md', 'en'), undefined);
  assert.equal(articleLang(undefined, 'en'), undefined);
});

test('isReferencesHeading: üç dilde', () => {
  assert.ok(isReferencesHeading('References') && isReferencesHeading(' Kaynaklar ') && isReferencesHeading('Referencias'));
  assert.ok(!isReferencesHeading('Further reading'));
});

test('bitiş işareti: Kaynaklar\'dan önceki son paragrafın sonunda, dile göre etiket', async () => {
  const md = 'Intro.\n\nLast one.\n\n### In short\n\n- a\n\n> quote\n\n## References\n\nRef para.\n';
  const html = await article('tr.md')(md);
  assert.equal(html.match(/class="end-mark"/g)?.length, 1);
  assert.match(html, /<p>Last <span class="end-word">one\.<svg class="end-mark"[^>]* role="img" aria-label="Son"[^>]*>(<path [^>]*stroke-width="[\d.]+"[^>]*><\/path>){2}<\/svg><\/span><\/p>/);
  assert.match(html, /<p>Ref para\.<\/p>/);
});

test('bitiş işareti: Kaynaklar yoksa son paragraf; özgünün dili frontmatter\'dan', async () => {
  const html = await article('index.md', { lang: 'en' })('One.\n\n## Conclusion\n\nTwo.\n\n```\ncode\n```\n');
  assert.match(html, /<p>Two\.<svg class="end-mark"[^>]*aria-label="End"/);
  assert.doesNotMatch(html, /One\.<svg/);
});

test('bitiş işareti son kelimeye bağlı; paragraf öğeyle bitiyorsa ardına', async () => {
  const html = await article('es.md')('Uno dos *tres*\n');
  assert.match(html, /<p>Uno dos <em>tres<\/em><svg class="end-mark"[^>]*aria-label="Fin"/);
  assert.match(await article('es.md')('A  b.\n'), /<p>A  <span class="end-word">b\.<svg/);
});

test('bitiş işareti: yazı dışındaki Markdown\'da yok', async () => {
  assert.doesNotMatch(await render('Para.\n'), /end-mark/);
});
