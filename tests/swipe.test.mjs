import { test } from 'node:test';
import assert from 'node:assert/strict';
import { swipeAxis, swipeStep } from '../src/lib/swipe.ts';

test('swipeAxis: yön ilk 10 px\'te', () => {
  assert.equal(swipeAxis(6, 6), null);
  assert.equal(swipeAxis(10, 2), 'x');
  assert.equal(swipeAxis(-12, 4), 'x');
  assert.equal(swipeAxis(4, 12), 'y');
  assert.equal(swipeAxis(8, -8), 'y');
});

test('swipeStep: sahnenin %20\'si ya da 0,4 px/ms', () => {
  const width = 358;
  assert.equal(swipeStep(-150, 250, width), 1);
  assert.equal(swipeStep(150, 900, width), -1);
  assert.equal(swipeStep(-40, 400, width), 0);
  assert.equal(swipeStep(-45, 60, width), 1);
  assert.equal(swipeStep(30, 60, width), -1);
  assert.equal(swipeStep(-71, 1000, width), 0);
  assert.equal(swipeStep(-72, 1000, width), 1);
  assert.equal(swipeStep(0, 0, width), 0);
  assert.equal(swipeStep(-5, 0, width), 0);
});
