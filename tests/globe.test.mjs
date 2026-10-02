import { test } from 'node:test';
import assert from 'node:assert/strict';
import { globe } from '../src/lib/globe.ts';

test('globe: yalnız görünen yarıküredeki noktalar, kürenin içinde; yollar tam sayı', () => {
  const g = globe([{ lat: 22.3, lon: 114.2 }, { lat: 40.7, lon: -74 }, { lat: -33.9, lon: -70.6 }], { lat: 20, lon: 90 }, 400);
  assert.equal(g.dots.length, 1);
  const [{ x, y }] = g.dots;
  assert.ok(Math.hypot(x - 200, y - 200) < 196);
  assert.ok(x > 200 && y < 200);
  for (const d of [g.sphere, g.land, g.borders]) {
    assert.ok(d.startsWith('M'));
    assert.doesNotMatch(d, /\d\.\d/);
  }
});
