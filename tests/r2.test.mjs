import { test } from 'node:test';
import assert from 'node:assert/strict';
import { credentials, retryable, sign, withRetry } from '../scripts/lib/r2.mjs';

test('sign: AWS SigV4 belgesindeki GET Object örneği', () => {
  const h = sign({
    method: 'GET',
    host: 'examplebucket.s3.amazonaws.com',
    path: '/test.txt',
    headers: { range: 'bytes=0-9' },
    payloadHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
    secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
    date: new Date('2013-05-24T00:00:00Z'),
    region: 'us-east-1',
  });
  assert.equal(
    h.authorization,
    'AWS4-HMAC-SHA256 Credential=AKIAIOSFODNN7EXAMPLE/20130524/us-east-1/s3/aws4_request, SignedHeaders=host;range;x-amz-content-sha256;x-amz-date, Signature=f0e8bdb87c964420e857bd35b5d6ed310bd44f0170aba48dd91039c6036bdb41',
  );
});

test('credentials: eksikse null, bozuk hesap kimliği reddedilir', () => {
  assert.equal(credentials({}), null);
  assert.throws(() => credentials({ R2_ACCOUNT_ID: 'x', R2_ACCESS_KEY_ID: 'a', R2_SECRET_ACCESS_KEY: 'b' }));
});

test('retryable: 429 ve 5xx yeniden denenir, 4xx ve başarı denenmez', () => {
  assert.deepEqual([200, 403, 404, 429, 500, 503].map(retryable), [false, false, false, true, true, true]);
});

const responses = (...statuses) => {
  const calls = [];
  return { calls, call: () => { calls.push(1); return Promise.resolve(new Response(null, { status: statuses[calls.length - 1] })); } };
};

test('withRetry: 429 sonrası başarı, bekleme artarak (1, 2 sn)', async () => {
  const waits = [];
  const r = responses(429, 503, 200);
  const res = await withRetry(r.call, { wait: async (ms) => waits.push(ms) });
  assert.equal(res.status, 200);
  assert.equal(r.calls.length, 3);
  assert.deepEqual(waits, [1000, 2000]);
});

test('withRetry: deneme hakkı bitince son yanıt döner; 404 hemen döner', async () => {
  const r = responses(429, 429, 429, 429, 200);
  assert.equal((await withRetry(r.call, { wait: async () => {} })).status, 429);
  assert.equal(r.calls.length, 4);
  const n = responses(404, 200);
  assert.equal((await withRetry(n.call, { wait: async () => {} })).status, 404);
  assert.equal(n.calls.length, 1);
});
