import { test } from 'node:test';
import assert from 'node:assert/strict';
import { languageName, levelSteps, period, PRESENT, SCALE } from '../src/lib/about.ts';

test('period: tek yıl, aralık, bugüne dek', () => {
  assert.equal(period(2023, undefined, 'present'), '2023');
  assert.equal(period(2012, 2017, 'present'), '2012–2017');
  assert.equal(period(2017, PRESENT, 'bugün'), '2017–bugün');
});

test('languageName: sayfanın dilinde, büyük harfle', () => {
  assert.equal(languageName('de', 'en'), 'German');
  assert.equal(languageName('de', 'tr'), 'Almanca');
  assert.equal(languageName('es', 'tr'), 'İspanyolca');
  assert.equal(languageName('tr', 'tr'), 'Türkçe');
});

test('languageName: bilinmeyen kod kırar', () => {
  assert.throws(() => languageName('qq', 'en'), /no en name/);
});

test('levelSteps: A1 bir parça, C2 ve ana dil tam ölçek', () => {
  assert.equal(levelSteps('A1'), 1);
  assert.equal(levelSteps('A2'), 2);
  assert.equal(levelSteps('C1'), 5);
  assert.equal(levelSteps('C2'), SCALE);
  assert.equal(levelSteps('native'), SCALE);
});
