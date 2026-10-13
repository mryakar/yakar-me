import { test } from 'node:test';
import assert from 'node:assert/strict';
import { byMonth, peak, yearsDescending } from '../src/lib/year.ts';

test('yearsDescending: ilk yıldan son yıla, yeniden eskiye, boş yıllar dahil', () => {
  assert.deepEqual(yearsDescending(2016, 2019), [2019, 2018, 2017, 2016]);
  assert.deepEqual(yearsDescending(2026, 2026), [2026]);
});

test('byMonth: on iki ay, sıra korunur', () => {
  const months = byMonth([{ m: 8, id: 'a' }, { m: 0, id: 'b' }, { m: 8, id: 'c' }], (x) => x.m);
  assert.equal(months.length, 12);
  assert.deepEqual(months[8].map((x) => x.id), ['a', 'c']);
  assert.deepEqual(months[0].map((x) => x.id), ['b']);
  assert.equal(months[11].length, 0);
});

test('peak: en büyük değer, eşitlikte ilki, hepsi sıfırsa yok', () => {
  const rows = [{ y: 2026, n: 4 }, { y: 2023, n: 9 }, { y: 2022, n: 9 }];
  assert.equal(peak(rows, (r) => r.n)?.y, 2023);
  assert.equal(peak([{ y: 2020, n: 0 }], (r) => r.n), undefined);
  assert.equal(peak([], (r) => r.n), undefined);
});
