import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { themeScriptPath } from '../src/lib/theme-script.ts';

test('themeScriptPath: /_astro/ altında içerik hash’li ad; aynı içerik aynı ad, değişen içerik başka ad', async () => {
  const a = await themeScriptPath('(function () {})();');
  assert.match(a, /^\/_astro\/theme\.[0-9a-f]{8}\.js$/);
  assert.equal(a, await themeScriptPath('(function () {})();'));
  assert.notEqual(a, await themeScriptPath('(function () { 1; })();'));
});

test('src/theme.js: satır içi değil, harici dosya; localStorage okur, has-webgl2 koyar', () => {
  const source = readFileSync(new URL('../src/theme.js', import.meta.url), 'utf8');
  assert.match(source, /localStorage\.getItem\('theme'\)/);
  assert.match(source, /has-webgl2/);
});
