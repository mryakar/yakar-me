import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setTimeout as sleep } from 'node:timers/promises';
import { drain } from '../scripts/lib/pool.mjs';

test('drain: her öğe bir kez, en çok işçi sayısı kadar eşzamanlı', async () => {
  const done = [];
  let running = 0;
  let peak = 0;
  await drain([1, 2, 3, 4, 5], 2, async (n) => {
    peak = Math.max(peak, ++running);
    await sleep(5);
    done.push(n);
    running--;
  });
  assert.deepEqual(done.toSorted(), [1, 2, 3, 4, 5]);
  assert.equal(peak, 2);
});

test('drain: işçi listesi verilirse her öğe bir işçiyle', async () => {
  const seen = new Map();
  await drain(['a', 'b', 'c'], ['tab1', 'tab2'], async (item, tab) => seen.set(item, tab));
  assert.equal(seen.size, 3);
  assert.ok([...seen.values()].every((tab) => tab === 'tab1' || tab === 'tab2'));
});
