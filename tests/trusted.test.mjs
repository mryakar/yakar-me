import { test } from 'node:test';
import assert from 'node:assert/strict';
import { trustedScriptUrl } from '../src/lib/trusted.ts';

const origin = 'https://yakar.me';
const worker = '/vendor/maplibre-gl-6.12.0/maplibre-gl-worker.mjs';

test('trustedScriptUrl: yalnız aynı kökende tek adres', () => {
  assert.equal(trustedScriptUrl(`${origin}${worker}`, origin, worker), `${origin}${worker}`);
  assert.equal(trustedScriptUrl(worker, origin, worker), `${origin}${worker}`);
  for (const bad of [
    `https://evil.example${worker}`,
    `//evil.example${worker}`,
    '/vendor/maplibre-gl-6.12.0/other.mjs',
    `${worker}?x=1`,
    `${worker}#x`,
    'data:text/javascript,alert(1)',
    'blob:https://yakar.me/1234',
    'javascript:alert(1)',
    '/vendor/maplibre-gl-6.12.0/../../evil.mjs',
  ]) {
    assert.throws(() => trustedScriptUrl(bad, origin, worker), TypeError, bad);
  }
});
