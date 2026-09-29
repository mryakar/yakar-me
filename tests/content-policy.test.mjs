import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const SCRIPT = resolve('scripts/content-policy.sh');
const DENY = 'forbidden-word\n\\bZ[0-9]{1,2}\\b';

function dist(files, env = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'policy-'));
  for (const [path, body] of Object.entries(files)) {
    mkdirSync(join(dir, 'dist', path, '..'), { recursive: true });
    writeFileSync(join(dir, 'dist', path), body);
  }
  const r = spawnSync('bash', [SCRIPT, 'dist'], { cwd: dir, encoding: 'utf8', env: { PATH: process.env.PATH, RUNNER_TEMP: dir, DENYLIST: DENY, ...env } });
  return { code: r.status, out: r.stdout + r.stderr };
}

test('temiz çıktı geçer', () => {
  assert.equal(dist({ 'index.html': '<p>hello</p>' }).code, 0);
});

test('metinde desen yakalanır (kısa desen dahil)', () => {
  assert.equal(dist({ 'a.html': 'a forbidden-word here' }).code, 1);
  assert.equal(dist({ 'b.html': 'see Z12 please' }).code, 1);
});

test('ikili dosyada okunabilir iz yakalanır, kısa desen tesadüfü yakalanmaz', () => {
  const binary = (text) => Buffer.concat([Buffer.from([0, 1, 2, 3, 0, 255]), Buffer.from(text), Buffer.from([0, 0, 7])]);
  assert.equal(dist({ 'x.gif': binary('meta: forbidden-word:end') }).code, 1);
  assert.equal(dist({ 'y.gif': binary('xx Z12 yy') }).code, 0);
});

test('secret yoksa kapalı başarısız', () => {
  const r = dist({ 'index.html': 'hello' }, { DENYLIST: '' });
  assert.equal(r.code, 1);
  assert.match(r.out, /CONTENT_DENYLIST secret is missing/);
});

test('bozuk desende kapalı başarısız', () => {
  const r = dist({ 'index.html': 'hello' }, { DENYLIST: 'ok\n(' });
  assert.equal(r.code, 2);
});
