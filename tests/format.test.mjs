import { test } from 'node:test';
import assert from 'node:assert/strict';
import { articlePath, formatDate, formatMonth, isoDate, readingMinutes, escapeXml } from '../src/lib/format.ts';

const d = new Date('2026-09-16T00:00:00Z');

test('articlePath: yazı adresi', () => {
  assert.equal(articlePath('explicit-locking'), '/writing/explicit-locking/');
});

test('formatDate: uzun ve kısa; eylül "Sep" (en-GB "Sept" değil)', () => {
  assert.equal(formatDate(d), '16 September 2026');
  assert.equal(formatDate(d, 'short'), '16 Sep 2026');
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
