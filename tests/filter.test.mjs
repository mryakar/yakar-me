import { test } from 'node:test';
import assert from 'node:assert/strict';
import { filterQuery, matchesFilters, readFilters, toggleFilter } from '../src/lib/filter.ts';

const known = new Map([
  ['category', new Set(['jazz', 'folk'])],
  ['genre', new Set(['bossa-nova', 'celtic-folk'])],
]);
const parentOf = new Map([
  ['bossa-nova', 'jazz'],
  ['celtic-folk', 'folk'],
]);

test('readFilters: yalnız sayfadaki değerler; tür kategorisini de seçer', () => {
  const state = readFilters(new URLSearchParams('category=folk&genre=bossa-nova&x=1'), known, parentOf);
  assert.deepEqual([...state], [['category', 'jazz'], ['genre', 'bossa-nova']]);
  assert.equal(readFilters(new URLSearchParams('category=<script>'), known, parentOf).size, 0);
});

test('toggleFilter: aynı değer kapatır, kategori değişince tür düşer, eski durum değişmez', () => {
  const start = new Map([['category', 'jazz'], ['genre', 'bossa-nova']]);
  assert.deepEqual([...toggleFilter(start, 'category', 'folk')], [['category', 'folk']]);
  assert.deepEqual([...toggleFilter(start, 'genre', 'bossa-nova')], [['category', 'jazz']]);
  assert.equal(toggleFilter(start, 'category', '').size, 0);
  assert.equal(start.size, 2);
});

test('filterQuery ve matchesFilters', () => {
  const state = new Map([['genre', 'bossa-nova'], ['category', 'jazz']]);
  assert.equal(filterQuery(['category', 'genre'], state), 'category=jazz&genre=bossa-nova');
  assert.equal(matchesFilters({ category: 'jazz', genre: 'bossa-nova' }, state), true);
  assert.equal(matchesFilters({ category: 'jazz', genre: 'soul-jazz' }, state), false);
  assert.equal(matchesFilters({}, new Map()), true);
});
