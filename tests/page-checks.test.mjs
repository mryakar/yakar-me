import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BUDGET, a11yProblems, budgetProblems, weigh } from '../scripts/lib/page-checks.mjs';

const r = (path, type, bytes) => ({ url: `http://localhost:8788${path}`, type, bytes });

test('weigh: aynı adres bir kez (worker önbellekten alır); site ve vendor betikleri ayrı', () => {
  const w = weigh([
    r('/', 'Document', 100),
    r('/_astro/a.js', 'Script', 10),
    r('/vendor/maplibre-gl-5/shared.mjs', 'Script', 500),
    r('/vendor/maplibre-gl-5/shared.mjs', 'Script', 500),
    r('/tiles/abc/0/0/0.mvt', 'Fetch', 40),
  ]);
  assert.deepEqual(w, { total: 650, requests: 4, script: 10, vendor: 500 });
});

test('budgetProblems: sınırda geçer, aşınca her ölçü ayrı yazılır', () => {
  assert.deepEqual(budgetProblems('/ (phone)', { ...BUDGET }), []);
  const over = budgetProblems('/ (phone)', { total: BUDGET.total + 1024, requests: 31, script: 51 * 1024, vendor: 1301 * 1024 });
  assert.equal(over.length, 4);
  assert.match(over[0], /^\/ \(phone\): 2001 KB in total, budget 2000 KB$/);
  assert.match(over[1], /31 requests, budget 30/);
  assert.match(over[2], /51 KB of site scripts/);
  assert.match(over[3], /1301 KB of vendored scripts/);
});

const ex = { rule: 'target-size', selector: '.map-marker', until: '2027-04-01', reason: 'equivalent list' };
const scan = (excepted) => ({
  where: '/photos/map/ (phone, dark)',
  violations: [{ id: 'target-size', impact: 'serious', nodes: [{ target: 'button', summary: 'too small', excepted }] }],
});

test('a11yProblems: istisnanın kapsadığı düğüm geçer', () => {
  assert.deepEqual(a11yProblems([scan(['.map-marker'])], [ex], '2026-10-04'), []);
});

test('a11yProblems: kapsanmayan ihlal kırar', () => {
  assert.match(a11yProblems([scan([])], [], '2026-10-04').join(), /target-size \(serious\) button — too small/);
});

test('a11yProblems: süresi dolan, gerekçesiz ya da artık eşleşmeyen istisna kırar', () => {
  assert.match(a11yProblems([scan(['.map-marker'])], [ex], '2027-04-02').join(), /expired on 2027-04-01/);
  assert.match(a11yProblems([scan(['.map-marker'])], [{ ...ex, reason: '' }], '2026-10-04').join(), /has no reason/);
  assert.match(a11yProblems([], [ex], '2026-10-04').join(), /no longer matches anything/);
});
