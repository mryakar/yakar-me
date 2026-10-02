import { parseArgs } from 'node:util';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { put, writeCredentials } from './lib/r2.mjs';
import { sha256 } from './lib/photo-store.mjs';
import {
  COMPRESSION, TILE_TYPE, decodeDirectory, decompress, idToZxy, readHeader, tilesInBounds, writeArchive,
} from './lib/pmtiles.mjs';
import { CACHE_DIR, CITY_ZOOMS, MANIFEST, WORLD_MAX_ZOOM, photographedDistricts } from './lib/map-store.mjs';
import { regions } from '../src/lib/map.ts';

const BUILDS = 'https://build-metadata.protomaps.dev/builds.json';
const SOURCE = (key) => `https://build.protomaps.com/${key}`;
const ATTRIBUTION = '© OpenStreetMap contributors · Protomaps';
const GAP = 64 * 1024;
const BATCH = 8 * 1024 * 1024;
const CONCURRENCY = 6;
const RETRIES = 4;

const { values: opts } = parseArgs({
  options: {
    build: { type: 'string' },
    'no-upload': { type: 'boolean', default: false },
  },
});

const fail = (msg) => {
  console.error(`✗ ${msg}`);
  process.exit(1);
};

const cities = regions(photographedDistricts());
if (cities.length === 0) fail('no photos, nothing to map');

const builds = await (await fetch(BUILDS)).json();
const build = opts.build ? builds.find((b) => b.key === `${opts.build}.pmtiles`) : builds.at(-1);
if (!build) fail(`no Protomaps build ${opts.build}`);
const url = SOURCE(build.key);
console.log(`Source: ${url} (basemap ${build.version})`);

let fetched = 0;
let requests = 0;
async function range(offset, length, attempt = 1) {
  const res = await fetch(url, { headers: { Range: `bytes=${offset}-${offset + length - 1}` } });
  if (res.status !== 206) {
    if (attempt < RETRIES) return range(offset, length, attempt + 1);
    fail(`${url}: HTTP ${res.status} for bytes ${offset}+${length}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length !== length) fail(`${url}: got ${buf.length} bytes, asked for ${length}`);
  fetched += buf.length;
  requests++;
  return buf;
}

const header = readHeader(await range(0, 16384));
if (header.tileType !== TILE_TYPE.mvt) fail(`source tiles are type ${header.tileType}, expected vector (MVT)`);
if (header.tileCompression !== COMPRESSION.gzip) fail(`source tiles use compression ${header.tileCompression}, expected gzip`);

const wanted = new Set();
for (let z = 0; z <= WORLD_MAX_ZOOM; z++) tilesInBounds([-180, -85.05, 180, 85.05], z).forEach((id) => wanted.add(id));
for (const c of cities) {
  for (let z = CITY_ZOOMS[0]; z <= CITY_ZOOMS[1]; z++) tilesInBounds(c.bounds, z).forEach((id) => wanted.add(id));
}
const ids = [...wanted].sort((a, b) => a - b);
const lowerBound = (v) => {
  let lo = 0;
  let hi = ids.length;
  while (lo < hi) {
    const m = (lo + hi) >> 1;
    if (ids[m] < v) lo = m + 1;
    else hi = m;
  }
  return lo;
};

const found = new Map();
async function walk(entries) {
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    const end = e.runLength === 0 ? (entries[i + 1]?.tileId ?? Infinity) : e.tileId + e.runLength;
    const first = lowerBound(e.tileId);
    if (first >= ids.length || ids[first] >= end) continue;
    if (e.runLength === 0) {
      await walk(decodeDirectory(decompress(await range(header.leafOffset + e.offset, e.length), header.internalCompression)));
      continue;
    }
    for (let j = first; j < ids.length && ids[j] < end; j++) found.set(ids[j], { offset: e.offset, length: e.length });
  }
}
await walk(decodeDirectory(decompress(await range(header.rootOffset, header.rootLength), header.internalCompression)));
console.log(`Tiles: ${ids.length} wanted, ${found.size} found in the source`);

const contents = [...new Map([...found.values()].map((c) => [c.offset, c])).values()].sort((a, b) => a.offset - b.offset);
const batches = [];
for (const c of contents) {
  const last = batches.at(-1);
  if (last && c.offset - last.end <= GAP && c.offset + c.length - last.start <= BATCH) {
    last.items.push(c);
    last.end = Math.max(last.end, c.offset + c.length);
  } else batches.push({ start: c.offset, end: c.offset + c.length, items: [c] });
}

const data = new Map();
const queue = [...batches];
await Promise.all(
  Array.from({ length: CONCURRENCY }, async () => {
    for (let b = queue.shift(); b; b = queue.shift()) {
      const buf = await range(header.dataOffset + b.start, b.end - b.start);
      for (const c of b.items) data.set(c.offset, buf.subarray(c.offset - b.start, c.offset - b.start + c.length));
    }
  }),
);

const tiles = [...found].map(([id, c]) => ({ id, data: data.get(c.offset) }));
const zooms = tiles.map((t) => idToZxy(t.id).z);
const archive = writeArchive({
  tiles,
  metadata: {
    attribution: ATTRIBUTION,
    source: build.key,
    basemap: build.version,
    regions: cities,
  },
  tileCompression: COMPRESSION.gzip,
  tileType: TILE_TYPE.mvt,
  bounds: [-180, -85.05, 180, 85.05],
  center: [0, 0, 0],
});
const hash = sha256(archive);
const file = `map-${hash.slice(0, 8)}.pmtiles`;
mkdirSync(CACHE_DIR, { recursive: true });
const local = join(CACHE_DIR, file);
writeFileSync(local, archive);
console.log(`Archive: ${local}, ${(archive.length / 1048576).toFixed(1)} MiB, ${tiles.length} tiles (z${Math.min(...zooms)}–${Math.max(...zooms)}), ${requests} requests, ${(fetched / 1048576).toFixed(1)} MiB read`);

if (!opts['no-upload']) {
  let creds;
  try {
    creds = writeCredentials();
  } catch (e) {
    fail(e.message);
  }
  await put(file, local, creds);
  console.log(`  ↑ ${file}`);
}

const record = {
  file,
  sha256: hash,
  bytes: archive.length,
  tiles: tiles.length,
  source: build.key,
  basemap: build.version,
  attribution: ATTRIBUTION,
  worldMaxZoom: WORLD_MAX_ZOOM,
  cityZooms: CITY_ZOOMS,
  regions: cities,
};
writeFileSync(MANIFEST, `${JSON.stringify(record, null, 2)}\n`);
console.log(`✓ ${MANIFEST}${opts['no-upload'] ? '  (not uploaded: CI will fail until the archive is in R2)' : ''}`);
