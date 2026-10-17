import { test } from 'node:test';
import assert from 'node:assert/strict';
import { searchIndexErrors } from '../scripts/lib/search-index.mjs';

const pages = new Map([
  ['/writing/a/', '<h1>A</h1>'],
  ['/reading/', '<li id="9780134685991">x</li>'],
  ['/tr/writing/a/', '<h1>A</h1>'],
]);
const page = (p) => pages.get(p);
const entry = (o) => ({
  kind: 'writing',
  url: '/writing/a/',
  title: 'A',
  date: '16 Aug 2026',
  detail: '',
  keywords: [],
  body: '',
  ...o,
});
const check = (entries, lang = 'en') => searchIndexErrors(JSON.stringify(entries), lang, page);

test('searchIndexErrors: geçerli indeks', () => {
  assert.deepEqual(check([entry(), entry({ kind: 'reading', url: '/reading/#9780134685991', title: 'B' })]), []);
  assert.deepEqual(check([entry({ url: '/tr/writing/a/' })], 'tr'), []);
});

test('searchIndexErrors: bozuk JSON, boş liste, biçim', () => {
  assert.deepEqual(searchIndexErrors('{', 'en', page), ['not valid JSON']);
  assert.deepEqual(check([]), ['not a non-empty list']);
  assert.match(check([entry({ kind: 'secret' })])[0], /malformed/);
  assert.match(check([entry({ title: '' })])[0], /malformed/);
  assert.match(check([entry({ keywords: [1] })])[0], /malformed/);
  assert.match(check([entry({ date: undefined })])[0], /malformed/);
});

test('searchIndexErrors: build dışı sayfa, olmayan kimlik, yanlış dil, tekrar', () => {
  assert.deepEqual(check([entry({ url: '/drafts/x/' })]), ['/drafts/x/: no such page in the build']);
  assert.deepEqual(check([entry({ kind: 'reading', url: '/reading/#123' })]), [
    '/reading/#123: no element with id "123" on the page',
  ]);
  assert.deepEqual(check([entry({ url: '/tr/writing/a/' })]), ['/tr/writing/a/: outside the en pages']);
  assert.deepEqual(check([entry()], 'tr'), ['/writing/a/: outside the tr pages']);
  assert.deepEqual(check([entry(), entry()]), ['/writing/a/: listed twice']);
});
