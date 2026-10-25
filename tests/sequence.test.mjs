import { test } from 'node:test';
import assert from 'node:assert/strict';
import { neighbours, others } from '../src/lib/sequence.ts';

const list = ['d', 'c', 'b', 'a'];
const is = (x) => (y) => y === x;

test('neighbours: yeniden eskiye listede önceki = daha eski, sonraki = daha yeni', () => {
  assert.deepEqual(neighbours(list, is('c')), { previous: 'b', next: 'd' });
});

test('neighbours: en yenide sonraki yok, en eskide önceki yok, tek öğede ikisi de yok', () => {
  assert.deepEqual(neighbours(list, is('d')), { previous: 'c', next: undefined });
  assert.deepEqual(neighbours(list, is('a')), { previous: undefined, next: 'b' });
  assert.deepEqual(neighbours(['x'], is('x')), { previous: undefined, next: undefined });
});

test('neighbours: listede olmayan öğe boş döner', () => {
  assert.deepEqual(neighbours(list, is('z')), {});
});

test('others: gösterilenler düşer, sıra korunur, sınır uygulanır', () => {
  assert.deepEqual(
    others(list, (x) => x === 'c' || x === 'b', 5),
    ['d', 'a'],
  );
  assert.deepEqual(others(list, is('d'), 2), ['c', 'b']);
  assert.deepEqual(
    others(list, () => true, 2),
    [],
  );
});
