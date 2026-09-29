import { test } from 'node:test';
import assert from 'node:assert/strict';
import { translationStatus } from '../src/lib/translations.ts';
import { pending } from '../src/i18n/pending.ts';

const originals = [
  { id: 'a', lang: 'en' },
  { id: 'b', lang: 'en' },
  { id: 'c', lang: 'tr' },
];
const status = (translations, lang, list = []) => Object.fromEntries(translationStatus('writing', originals, translations, lang, list));

test('özgün, çevrilmiş ve bekleyen', () => {
  assert.deepEqual(status(['a/tr', 'c/en'], 'tr', ['/writing/b/']), { a: 'translated', b: 'pending', c: 'original' });
  assert.deepEqual(status(['a/tr', 'c/en'], 'en', ['/writing/b/']), { a: 'original', b: 'original', c: 'translated' });
});

test('karşılığı eksik ve listede olmayan içerik build\'i kırar', () => {
  assert.throws(() => status(['a/tr', 'c/en'], 'tr'), /\/writing\/b\/ has no tr translation/);
});

test('çevrilmiş içerik listede kalırsa kırar', () => {
  assert.throws(() => status(['a/tr', 'b/tr', 'c/en'], 'tr', ['/writing/b/']), /is translated — remove it/);
});

test('özgünü olmayan ya da özgünle aynı dilde çeviri kırar', () => {
  assert.throws(() => status(['z/tr', 'a/tr', 'b/tr', 'c/en'], 'tr'), /has no original/);
  assert.throws(() => status(['a/en'], 'tr'), /original's own language/);
});

test('listede var olmayan ya da biçimsiz yol kırar', () => {
  assert.throws(() => status(['a/tr', 'b/tr', 'c/en'], 'tr', ['/writing/nope/']), /does not exist/);
  assert.throws(() => status(['a/tr', 'b/tr', 'c/en'], 'tr', ['/about/']), /is not a/);
  assert.doesNotThrow(() => status(['a/tr', 'b/tr', 'c/en'], 'tr', ['/photos/elsewhere/']));
});

test('bekleme listesi: yinelenen yol yok', () => {
  assert.equal(new Set(pending).size, pending.length);
});
