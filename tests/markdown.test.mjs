import { test } from 'node:test';
import assert from 'node:assert/strict';
import { markdownToHtml } from 'satteri';
import { noRawHtml, articleBlocks, isSummaryHeading } from '../src/lib/markdown.ts';

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
  assert.ok(isSummaryHeading(' Kısaca ') && isSummaryHeading('In short'));
  assert.ok(!isSummaryHeading('TL;DR') && !isSummaryHeading('Kısa'));
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
