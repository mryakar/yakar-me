import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { BASELINE, describe, expand, missingChars, ranges } from '../scripts/lib/charset.mjs';
import { FONT_FILES } from '../src/lib/fonts.ts';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const charset = JSON.parse(read('src/fonts/charset.json'));

test('ranges/expand: bitişik kod noktaları aralık olur, geri açılınca aynı küme', () => {
  const r = ranges('abcdxyz ğİ');
  assert.deepEqual(r, [
    'U+0020',
    'U+0061-0064',
    'U+0078-007A',
    'U+011E-011F'.replace('U+011E-011F', 'U+011F'),
    'U+0130',
  ]);
  assert.deepEqual([...expand(r)].sort(), [...'abcdxyz ğİ'].sort());
});

test('missingChars: kümede olmayan harfleri sayar, boşlukları saymaz; describe kod noktasını yazar', () => {
  const set = expand(['U+0061-007A']);
  assert.deepEqual(missingChars('abc  d\n', set), []);
  assert.deepEqual(missingChars('ab ß', set), ['ß']);
  assert.equal(describe('ß'), 'U+00DF "ß"');
});

test('taban küme: ASCII, Türkçe ve İspanyolca harfler, tipografik işaretler', () => {
  for (const c of 'AZaz09ğĞıİşŞçÇöÖüÜñÑ¿¡áéíóúÁÉÍÓÚ—–“”‘’…·→↗×≤°♯♭⌘€') assert.ok(BASELINE.includes(c), c);
});

test('src/fonts/charset.json: taban kümeyi kapsar, aralıklar geçerli', () => {
  const set = expand(charset.ranges);
  assert.equal(set.size, charset.count);
  assert.deepEqual(missingChars(BASELINE, set), []);
});

test('src/fonts: her dosya var, fonts.css ve FONT_FILES aynı listeyi taşır', () => {
  const css = read('src/styles/fonts.css');
  for (const { file } of FONT_FILES) {
    assert.ok(existsSync(new URL(`../src/fonts/${file}`, import.meta.url)), file);
    assert.ok(css.includes(`url('../fonts/${file}')`), `${file} fonts.css'te`);
  }
  assert.equal((css.match(/url\('\.\.\/fonts\//g) ?? []).length, FONT_FILES.length);
  assert.ok(!css.includes('@fontsource'));
});
