import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  allGenres,
  byYear,
  categories,
  categoryOf,
  finishedDate,
  genres,
  isIsbn13,
  newestFirst,
  spineHeight,
  spineThickness,
  SPINE_HEIGHTS,
  SPINE_THICKNESSES,
} from '../src/lib/book.ts';
import { ui } from '../src/i18n/ui.ts';

const books = JSON.parse(readFileSync(new URL('../src/content/books.json', import.meta.url), 'utf8'));

test('isIsbn13: denetim hanesi', () => {
  assert.equal(isIsbn13('9781098119058'), true);
  assert.equal(isIsbn13('9781098119059'), false);
  assert.equal(isIsbn13('978109811905'), false);
  assert.equal(isIsbn13('1781098119058'), false);
});

test('her türün tek bir kategorisi var', () => {
  assert.equal(new Set(allGenres).size, allGenres.length);
  for (const c of categories) for (const g of genres[c]) assert.equal(categoryOf(g), c);
});

test('newestFirst: son biten üstte, aynı ayda dosyadaki sıra', () => {
  const list = [
    { id: 'a', finished: '2018-01', position: 0 },
    { id: 'b', finished: '2025-08', position: 3 },
    { id: 'c', finished: '2025-08', position: 1 },
    { id: 'd', finished: '2026-09', position: 2 },
  ];
  assert.deepEqual(newestFirst(list).map((b) => b.id), ['d', 'c', 'b', 'a']);
  assert.deepEqual(list.map((b) => b.id), ['a', 'b', 'c', 'd']);
});

test('byYear: sırayı bozmadan yıllara böler', () => {
  const list = ['2025-09', '2025-08', '2024-07', '2022-11'].map((m, i) => ({ i, finished: finishedDate(m) }));
  assert.deepEqual(
    byYear(list).map(({ year, books }) => [year, books.map((b) => b.i)]),
    [[2025, [0, 1]], [2024, [2]], [2022, [3]]],
  );
});

test('finishedDate: ayın ilk günü, UTC', () => {
  assert.equal(finishedDate('2026-09').toISOString(), '2026-09-01T00:00:00.000Z');
});

test('sırt kalınlığı sayfa sayısıyla artar, ölçeğin içinde kalır', () => {
  assert.equal(spineThickness(1), 0);
  assert.equal(spineThickness(46), 0);
  assert.equal(spineThickness(400), 7);
  assert.equal(spineThickness(673), 13);
  assert.equal(spineThickness(5000), SPINE_THICKNESSES - 1);
  assert.ok(spineThickness(120) < spineThickness(240));
});

test('sırt yüksekliği ISBN\'den, sabit ve ölçeğin içinde', () => {
  assert.equal(spineHeight('9781098119058'), spineHeight('9781098119058'));
  for (const b of books) assert.ok(spineHeight(b.id) >= 0 && spineHeight(b.id) < SPINE_HEIGHTS);
});

test('kitap verisi: geçerli ve tekil ISBN, türüne uyan kategori, yalnız biten kitapta bitiş ayı', () => {
  assert.equal(new Set(books.map((b) => b.id)).size, books.length);
  for (const b of books) {
    assert.ok(isIsbn13(b.id), b.id);
    assert.equal(categoryOf(b.genre), b.category, b.id);
    assert.equal(b.status === 'finished', typeof b.finished === 'string', b.id);
  }
});

test('kategori, tür ve dil adları iki dilde tam', () => {
  for (const lang of ['en', 'tr']) {
    const t = ui[lang].reading;
    for (const c of categories) assert.ok(t.categories[c], `${lang} ${c}`);
    for (const g of allGenres) assert.ok(t.genres[g], `${lang} ${g}`);
    for (const b of books) assert.ok(t.languages[b.originalLanguage] && t.languages[b.readIn], `${lang} ${b.id}`);
  }
});

test('şimdi notu yalnız okunan kitapta ve iki dilde', () => {
  for (const b of books.filter((b) => b.nowNote)) {
    assert.equal(b.status, 'reading', b.id);
    for (const lang of ['en', 'tr']) assert.ok(b.nowNote[lang]?.trim(), `${lang} ${b.id}`);
  }
});
