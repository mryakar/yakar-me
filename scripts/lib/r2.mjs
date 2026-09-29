import { createHash, createHmac } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { BUCKET } from './photo-store.mjs';

const CONTENT_TYPES = { avif: 'image/avif', webp: 'image/webp' };
const REGION = 'auto';
const SERVICE = 's3';

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

async function request(method, key, creds, body) {
  if (!/^[a-z0-9-]+\.(avif|webp)$/.test(key)) throw new Error(`refusing unexpected object key ${key}`);
  const host = `${creds.account}.r2.cloudflarestorage.com`;
  const path = `/${BUCKET}/${key}`;
  const headers = body ? { 'content-type': CONTENT_TYPES[key.split('.').pop()], 'content-length': body.length } : {};
  const signed = sign({ method, host, path, headers, payloadHash: hash(body ?? ''), date: new Date(), ...creds });
  const res = await fetch(`https://${host}${path}`, { method, headers: signed, body });
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
