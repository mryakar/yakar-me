import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fragmentId } from '../src/lib/fragment.ts';

test('fragmentId: # düşer, kodlanmış değer çözülür', () => {
  assert.equal(fragmentId('#hong-kong'), 'hong-kong');
  assert.equal(fragmentId('#Q1207691'), 'Q1207691');
  assert.equal(fragmentId('#%C3%A7ar%C5%9F%C4%B1'), 'çarşı');
  assert.equal(fragmentId(''), '');
});

test('fragmentId: bozuk kodlamada boş (hata fırlatmaz)', () => {
  assert.equal(fragmentId('#%E0%A4%A'), '');
  assert.equal(fragmentId('#%'), '');
});
