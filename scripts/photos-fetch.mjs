import { copyFileSync, mkdirSync, readFileSync, rmSync, existsSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { inspectImage } from './lib/image-meta.mjs';
import { credentials, get } from './lib/r2.mjs';
import { PUBLIC_DIR, records, sha256 } from './lib/photo-store.mjs';

const CONCURRENCY = 6;
const variants = records().flatMap((r) => [...r.data.variants.avif, ...r.data.variants.webp]);
if (variants.length === 0) {
  console.log('✓ no photos');
  process.exit(0);
}

mkdirSync(PUBLIC_DIR, { recursive: true });
const verify = (buf, v) => {
  if (sha256(buf) !== v.sha256) return 'SHA-256 does not match the photo data';
  const r = inspectImage(buf);
  if (!r.ok) return r.errors.join('; ');
  if (r.width !== v.width || r.height !== v.height) return 'dimensions do not match the photo data';
  return null;
};

const missing = variants.filter((v) => {
  const path = join(PUBLIC_DIR, v.file);
  return !(existsSync(path) && verify(readFileSync(path), v) === null);
});

const creds = credentials();
if (missing.length && !creds) {
  console.error(`✗ ${missing.length} variant(s) missing locally and no R2 read credentials (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY)`);
  process.exit(1);
}

const tmp = mkdtempSync(join(tmpdir(), 'photos-'));
const errors = [];
let fetched = 0;
const queue = [...missing];
await Promise.all(
  Array.from({ length: CONCURRENCY }, async () => {
    for (let v = queue.shift(); v; v = queue.shift()) {
      const part = join(tmp, v.file);
      try {
        await get(v.file, part, creds);
        const problem = verify(readFileSync(part), v);
        if (problem) errors.push(`${v.file}: ${problem}`);
        else {
          copyFileSync(part, join(PUBLIC_DIR, v.file));
          fetched++;
        }
      } catch (e) {
        errors.push(`${v.file}: ${e.message}`);
      }
    }
  }),
);
rmSync(tmp, { recursive: true, force: true });

if (errors.length) {
  console.error(errors.map((e) => `✗ ${e}`).join('\n'));
  process.exit(1);
}
console.log(`✓ ${variants.length} variants verified (${fetched} fetched from R2)`);
