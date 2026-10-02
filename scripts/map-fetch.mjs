import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { credentials, get } from './lib/r2.mjs';
import { sha256 } from './lib/photo-store.mjs';
import { COMPRESSION, TILE_TYPE, readHeader, readTiles } from './lib/pmtiles.mjs';
import { CACHE_DIR, TILES_DIR, manifest, tileDir } from './lib/map-store.mjs';

const fail = (msg) => {
  console.error(`✗ ${msg}`);
  process.exit(1);
};

const m = manifest();
if (!m) {
  console.log('✓ no map');
  process.exit(0);
}

const target = tileDir(m);
const done = join(CACHE_DIR, `${m.sha256.slice(0, 8)}.complete`);
if (existsSync(target) && existsSync(done) && Number(readFileSync(done, 'utf8')) === m.tiles) {
  console.log(`✓ ${m.tiles} map tiles already in ${target}`);
  process.exit(0);
}

mkdirSync(CACHE_DIR, { recursive: true });
const local = join(CACHE_DIR, m.file);
const verified = (path) => existsSync(path) && sha256(readFileSync(path)) === m.sha256;
let fetched = false;
if (!verified(local)) {
  const creds = credentials();
  if (!creds) fail(`${m.file} missing locally and no R2 read credentials (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY)`);
  const part = `${local}.part`;
  await get(m.file, part, creds);
  if (sha256(readFileSync(part)) !== m.sha256) {
    rmSync(part);
    fail(`${m.file}: SHA-256 does not match ${m.sha256}`);
  }
  renameSync(part, local);
  fetched = true;
}

const archive = readFileSync(local);
const h = readHeader(archive);
if (h.tileType !== TILE_TYPE.mvt || h.tileCompression !== COMPRESSION.gzip) fail(`${m.file}: expected gzip-compressed vector tiles`);

rmSync(TILES_DIR, { recursive: true, force: true });
const staging = `${target}.part`;
let count = 0;
for (const t of readTiles(archive)) {
  const path = join(staging, String(t.z), String(t.x), `${t.y}.mvt`);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, gunzipSync(t.data));
  count++;
}
if (count !== m.tiles) fail(`${m.file}: ${count} tiles, the manifest says ${m.tiles}`);
renameSync(staging, target);
writeFileSync(done, String(count));
console.log(`✓ ${count} map tiles in ${target} (${fetched ? 'fetched from R2' : 'from the local copy'}, SHA-256 verified)`);
