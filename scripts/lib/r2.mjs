import { createHash, createHmac } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { BUCKET } from './photo-store.mjs';

export const WRITE_TOKEN_FILE = join(homedir(), '.config', 'yakar-me', 'r2-write.env');
const CONTENT_TYPES = { avif: 'image/avif', webp: 'image/webp', pmtiles: 'application/octet-stream' };
const REGION = 'auto';
const SERVICE = 's3';
const ATTEMPTS = 4;
const RETRY_BASE_MS = 1000;

const hash = (data) => createHash('sha256').update(data).digest('hex');
const hmac = (key, data) => createHmac('sha256', key).update(data).digest();

export function sign({ method, host, path, headers, payloadHash, accessKeyId, secretAccessKey, date, region = REGION }) {
  const amzDate = date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const day = amzDate.slice(0, 8);
  const all = { ...headers, host, 'x-amz-content-sha256': payloadHash, 'x-amz-date': amzDate };
  const names = Object.keys(all).map((k) => k.toLowerCase()).sort();
  const lower = Object.fromEntries(Object.entries(all).map(([k, v]) => [k.toLowerCase(), String(v).trim()]));
  const signedHeaders = names.join(';');
  const canonical = [method, path, '', ...names.map((n) => `${n}:${lower[n]}`), '', signedHeaders, payloadHash].join('\n');
  const scope = `${day}/${region}/${SERVICE}/aws4_request`;
  const toSign = ['AWS4-HMAC-SHA256', amzDate, scope, hash(canonical)].join('\n');
  const key = hmac(hmac(hmac(hmac(`AWS4${secretAccessKey}`, day), region), SERVICE), 'aws4_request');
  const signature = createHmac('sha256', key).update(toSign).digest('hex');
  return {
    ...Object.fromEntries(Object.entries(all).filter(([k]) => k !== 'host')),
    authorization: `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
  };
}

export function credentials(env = process.env) {
  const { R2_ACCOUNT_ID: account, R2_ACCESS_KEY_ID: accessKeyId, R2_SECRET_ACCESS_KEY: secretAccessKey } = env;
  if (!account || !accessKeyId || !secretAccessKey) return null;
  if (!/^[0-9a-f]{32}$/.test(account)) throw new Error('R2_ACCOUNT_ID must be 32 hex characters');
  return { account, accessKeyId, secretAccessKey };
}

export function writeCredentials(file = WRITE_TOKEN_FILE) {
  if (!existsSync(file)) throw new Error(`R2 write token not found: ${file}`);
  if (statSync(file).mode & 0o077) throw new Error(`${file} must be readable only by you (chmod 600)`);
  const creds = credentials(
    Object.fromEntries(
      readFileSync(file, 'utf8')
        .split('\n')
        .map((l) => /^\s*(R2_ACCOUNT_ID|R2_ACCESS_KEY_ID|R2_SECRET_ACCESS_KEY)\s*=\s*(\S+)\s*$/.exec(l))
        .filter(Boolean)
        .map((m) => [m[1], m[2]]),
    ),
  );
  if (!creds) throw new Error(`${file} needs R2_ACCOUNT_ID, R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY`);
  return creds;
}

export const retryable = (status) => status === 429 || status >= 500;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function withRetry(call, { attempts = ATTEMPTS, wait = sleep } = {}) {
  for (let attempt = 1; ; attempt++) {
    const res = await call();
    if (!retryable(res.status) || attempt === attempts) return res;
    await res.body?.cancel();
    await wait(RETRY_BASE_MS * 2 ** (attempt - 1));
  }
}

async function request(method, key, creds, body) {
  if (!/^[a-z0-9-]+\.(avif|webp|pmtiles)$/.test(key)) throw new Error(`refusing unexpected object key ${key}`);
  const host = `${creds.account}.r2.cloudflarestorage.com`;
  const path = `/${BUCKET}/${key}`;
  const headers = body ? { 'content-type': CONTENT_TYPES[key.split('.').pop()], 'content-length': body.length } : {};
  const res = await withRetry(() => {
    const signed = sign({ method, host, path, headers, payloadHash: hash(body ?? ''), date: new Date(), ...creds });
    return fetch(`https://${host}${path}`, { method, headers: signed, body });
  });
  if (!res.ok) throw new Error(`R2 ${method} ${key}: ${res.status} ${(await res.text()).slice(0, 300)}`);
  return res;
}

export async function put(key, file, creds) {
  await request('PUT', key, creds, await readFile(file));
}

export async function get(key, file, creds) {
  const res = await request('GET', key, creds);
  await writeFile(file, Buffer.from(await res.arrayBuffer()));
}
