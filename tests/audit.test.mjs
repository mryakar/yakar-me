import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { advisories, auditProblems } from '../scripts/lib/audit.mjs';

const advisory = (id, name = 'pkg') => ({ name, title: `${name} issue`, severity: 'high', url: `https://github.com/advisories/${id}` });
const report = (...vias) => ({
  vulnerabilities: {
    parent: { name: 'parent', via: vias.map((v) => v.name) },
    ...Object.fromEntries(vias.map((v) => [v.name, { name: v.name, via: [v] }])),
  },
});
const A = advisory('GHSA-aaaa-bbbb-cccc', 'a');
const B = advisory('GHSA-dddd-eeee-ffff', 'b');
const exception = (id, until = '2026-12-31') => ({ id, until, reason: 'test' });

test('advisories: GHSA kimlikleri tekil, paket adı dizgileri atlanır', () => {
  const r = report(A, B);
  r.vulnerabilities.c = { name: 'c', via: [A] };
  assert.deepEqual(advisories(r).map((a) => a.id), ['GHSA-aaaa-bbbb-cccc', 'GHSA-dddd-eeee-ffff']);
});

test('advisories: rapor yoksa ya da kimliksiz uyarıda kapalı başarısız', () => {
  assert.throws(() => advisories({ error: { summary: 'network' } }), /network/);
  assert.throws(() => advisories(undefined), /no report/);
  assert.throws(() => advisories(report({ name: 'x', title: 't', url: 'https://example.com/1' })), /without a GHSA id/);
});

test('auditProblems: uyarı yoksa ve istisna yoksa temiz', () => {
  assert.deepEqual(auditProblems({ vulnerabilities: {} }, [], '2026-10-03'), []);
});

test('auditProblems: istisnalı uyarı geçer, öbürü kırar', () => {
  assert.deepEqual(auditProblems(report(A), [exception('GHSA-aaaa-bbbb-cccc')], '2026-10-03'), []);
  const problems = auditProblems(report(A, B), [exception('GHSA-aaaa-bbbb-cccc')], '2026-10-03');
  assert.equal(problems.length, 1);
  assert.match(problems[0], /GHSA-dddd-eeee-ffff b \(high\)/);
});

test('auditProblems: süresi dolan istisna kırar, son gün geçer', () => {
  assert.deepEqual(auditProblems(report(A), [exception('GHSA-aaaa-bbbb-cccc', '2026-10-03')], '2026-10-03'), []);
  assert.match(auditProblems(report(A), [exception('GHSA-aaaa-bbbb-cccc', '2026-10-02')], '2026-10-03')[0], /expired on 2026-10-02/);
});

test('auditProblems: gereksiz kalan istisna kırar', () => {
  assert.match(auditProblems({ vulnerabilities: {} }, [exception('GHSA-aaaa-bbbb-cccc')], '2026-10-03')[0], /no longer needed/);
});

test('audit-exceptions.json: her kayıtta kimlik, tarih ve gerekçe', () => {
  const list = JSON.parse(readFileSync(new URL('../scripts/audit-exceptions.json', import.meta.url), 'utf8'));
  for (const e of list) {
    assert.match(e.id, /^GHSA-\w{4}-\w{4}-\w{4}$/);
    assert.match(e.until, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(e.reason.length > 20);
  }
});
