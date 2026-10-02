import { test } from 'node:test';
import assert from 'node:assert/strict';
import { targetWidths } from '../scripts/lib/variants.mjs';

test('targetWidths: yatay kare, en uzun kenar ≤ 2560', () => {
  assert.deepEqual(targetWidths(6240, 4160), [320, 640, 1280, 1920, 2560]);
});

test('targetWidths: dikey karede genişlik küçülür, yuvarlama 2561 üretmez', () => {
  assert.deepEqual(targetWidths(4160, 6240), [320, 640, 1280, 1706]);
  assert.deepEqual(targetWidths(3024, 4032), [320, 640, 1280, 1920]);
});

test('targetWidths: küçük kaynak büyütülmez, aynı genişlik bir kez', () => {
  assert.deepEqual(targetWidths(1000, 750), [320, 640, 1000]);
});
