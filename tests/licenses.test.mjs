import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('public/licenses/maplibre-gl.txt: paketteki LICENSE.txt ile aynı', () => {
  assert.equal(read('public/licenses/maplibre-gl.txt'), read('node_modules/maplibre-gl/LICENSE.txt'));
});

test('public/licenses/OFL.txt: her fontun telif satırı ve paketteki OFL metni', () => {
  const ofl = read('public/licenses/OFL.txt');
  for (const pkg of [
    '@fontsource-variable/geist',
    '@fontsource-variable/geist-mono',
    '@fontsource-variable/newsreader',
    '@fontsource/instrument-serif',
  ]) {
    const [notice, ...body] = read(`node_modules/${pkg}/LICENSE`).split('\n');
    const holder = /^Copyright \d{4} The .+? Project Authors \(\S+?\)/.exec(notice)[0].replace(/\.git\)$/, ')');
    assert.ok(ofl.includes(holder), `${pkg}: ${holder}`);
    assert.ok(ofl.endsWith(body.join('\n')), pkg);
  }
});
