import { test } from 'node:test';
import assert from 'node:assert/strict';
import { articlePath, documentTitle, formatDate, formatMonth, isoDate, readingMinutes, escapeXml, shortMonth, monthYear, englishOrdinal, plural } from '../src/lib/format.ts';

const d = new Date('2026-09-16T00:00:00Z');

test('articlePath: yazı adresi', () => {
  assert.equal(articlePath('explicit-locking'), '/writing/explicit-locking/');
});

test('formatDate: uzun ve kısa; eylül "Sep" (en-GB "Sept" değil)', () => {
  assert.equal(formatDate(d), '16 September 2026');
  assert.equal(formatDate(d, 'short'), '16 Sep 2026');
});

test('Türkçe tarih: uzun, kısa, ay', () => {
  assert.equal(formatDate(d, 'long', 'tr'), '16 Eylül 2026');
  assert.equal(formatDate(new Date('2022-04-15T00:00:00Z'), 'long', 'tr'), '15 Nisan 2022');
  assert.equal(formatDate(new Date('2026-02-03T00:00:00Z'), 'short', 'tr'), '3 Şub 2026');
  assert.equal(formatMonth(new Date('2026-08-01T00:00:00Z'), 'tr'), 'Ağu 2026');
});

test('articlePath: Türkçe önek', () => {
  assert.equal(articlePath('explicit-locking', 'tr'), '/tr/writing/explicit-locking/');
});

test('formatMonth ve isoDate', () => {
  assert.equal(formatMonth(d), 'Sep 2026');
  assert.equal(isoDate(d), '2026-09-16');
});

test('readingMinutes: dakikada 240 kelime, en az 1', () => {
  assert.equal(readingMinutes(''), 1);
  assert.equal(readingMinutes('word '.repeat(4800)), 20);
});

test('escapeXml: beş özel karakter', () => {
  assert.equal(escapeXml(`a & b < c > "d" 'e'`), 'a &amp; b &lt; c &gt; &quot;d&quot; &apos;e&apos;');
});

test('shortMonth ve monthYear: iki dilde', () => {
  assert.equal(shortMonth(d), 'Sep');
  assert.equal(shortMonth(new Date('2025-08-01T00:00:00Z'), 'tr'), 'Ağu');
  assert.equal(monthYear(d), 'September 2026');
  assert.equal(monthYear(new Date('2018-02-01T00:00:00Z'), 'tr'), 'Şubat 2018');
});

test('englishOrdinal', () => {
  assert.deepEqual([1, 2, 3, 4, 11, 12, 13, 21, 22, 102, 111].map(englishOrdinal), ['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd', '102nd', '111th']);
});

test('plural: tekil ve çoğul', () => {
  const forms = { one: '{n} book', other: '{n} books' };
  assert.equal(plural(forms, 1), '1 book');
  assert.equal(plural(forms, 0), '0 books');
  assert.equal(plural(forms, 29), '29 books');
});

test('documentTitle: ana sayfa site adı, öbürleri sayfa — site', () => {
  assert.equal(documentTitle(), 'Yakar');
  assert.equal(documentTitle('Writing'), 'Writing — Yakar');
  assert.equal(documentTitle('Hong Kong', 'Fotoğraflar'), 'Hong Kong — Fotoğraflar — Yakar');
});
