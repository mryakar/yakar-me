import { gunzipSync, gzipSync } from 'node:zlib';

export const HEADER_BYTES = 127;
export const ROOT_LIMIT = 16384;
export const COMPRESSION = { none: 1, gzip: 2 };
export const TILE_TYPE = { mvt: 1 };
const MAGIC = 'PMTiles';
const VERSION = 3;

const tilesBelow = (z) => (4 ** z - 1) / 3;

function rotate(n, xy, rx, ry) {
  if (ry !== 0) return;
  if (rx === 1) {
    xy[0] = n - 1 - xy[0];
    xy[1] = n - 1 - xy[1];
  }
  [xy[0], xy[1]] = [xy[1], xy[0]];
}

export function zxyToId(z, x, y) {
  const n = 2 ** z;
  if (!Number.isInteger(z) || z < 0 || z > 26 || x < 0 || y < 0 || x >= n || y >= n) {
    throw new RangeError(`tile ${z}/${x}/${y} is outside the grid`);
  }
  const xy = [x, y];
  let d = 0;
  for (let s = n / 2; s >= 1; s /= 2) {
    const rx = (xy[0] & s) > 0 ? 1 : 0;
    const ry = (xy[1] & s) > 0 ? 1 : 0;
    d += s * s * ((3 * rx) ^ ry);
    rotate(s, xy, rx, ry);
  }
  return tilesBelow(z) + d;
}

export function idToZxy(id) {
  let z = 0;
  while (tilesBelow(z + 1) <= id) z++;
  const n = 2 ** z;
  let t = id - tilesBelow(z);
  const xy = [0, 0];
  for (let s = 1; s < n; s *= 2) {
    const rx = 1 & Math.floor(t / 2);
    const ry = 1 & (t ^ rx);
    rotate(s, xy, rx, ry);
    xy[0] += s * rx;
    xy[1] += s * ry;
    t = Math.floor(t / 4);
  }
  return { z, x: xy[0], y: xy[1] };
}

export const lonToTileX = (lon, z) => Math.min(2 ** z - 1, Math.floor(((lon + 180) / 360) * 2 ** z));

export function latToTileY(lat, z) {
  const r = (lat * Math.PI) / 180;
  const y = Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z);
  return Math.min(2 ** z - 1, Math.max(0, y));
}

export function tilesInBounds([west, south, east, north], z) {
  const ids = [];
  for (let x = lonToTileX(west, z); x <= lonToTileX(east, z); x++) {
    for (let y = latToTileY(north, z); y <= latToTileY(south, z); y++) ids.push(zxyToId(z, x, y));
  }
  return ids;
}

function writeVarint(out, n) {
  while (n >= 0x80) {
    out.push((n % 0x80) | 0x80);
    n = Math.floor(n / 0x80);
  }
  out.push(n);
}

export function encodeDirectory(entries) {
  const out = [];
  writeVarint(out, entries.length);
  let last = 0;
  for (const e of entries) {
    writeVarint(out, e.tileId - last);
    last = e.tileId;
  }
  for (const e of entries) writeVarint(out, e.runLength);
  for (const e of entries) writeVarint(out, e.length);
  entries.forEach((e, i) => {
    const prev = entries[i - 1];
    writeVarint(out, prev && e.offset === prev.offset + prev.length ? 0 : e.offset + 1);
  });
  return Buffer.from(out);
}

export function decodeDirectory(buf) {
  let pos = 0;
  const varint = () => {
    let n = 0;
    let scale = 1;
    for (;;) {
      if (pos >= buf.length) throw new Error('directory ends inside a varint');
      const byte = buf[pos++];
      n += (byte & 0x7f) * scale;
      if (byte < 0x80) return n;
      scale *= 0x80;
    }
  };
  const count = varint();
  const entries = Array.from({ length: count }, () => ({ tileId: 0, runLength: 0, length: 0, offset: 0 }));
  let last = 0;
  for (const e of entries) e.tileId = last += varint();
  for (const e of entries) e.runLength = varint();
  for (const e of entries) e.length = varint();
  entries.forEach((e, i) => {
    const v = varint();
    if (v === 0 && i === 0) throw new Error('first directory entry has no offset');
    e.offset = v === 0 ? entries[i - 1].offset + entries[i - 1].length : v - 1;
  });
  if (pos !== buf.length) throw new Error('trailing bytes after the directory');
  return entries;
}

const u64 = (buf, at) => {
  const n = buf.readBigUInt64LE(at);
  if (n > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('offset too large');
  return Number(n);
};

export function readHeader(buf) {
  if (buf.length < HEADER_BYTES || buf.subarray(0, 7).toString('latin1') !== MAGIC) throw new Error('not a PMTiles archive');
  if (buf[7] !== VERSION) throw new Error(`PMTiles version ${buf[7]}, expected ${VERSION}`);
  const e7 = (at) => buf.readInt32LE(at) / 1e7;
  return {
    rootOffset: u64(buf, 8),
    rootLength: u64(buf, 16),
    metadataOffset: u64(buf, 24),
    metadataLength: u64(buf, 32),
    leafOffset: u64(buf, 40),
    leafLength: u64(buf, 48),
    dataOffset: u64(buf, 56),
    dataLength: u64(buf, 64),
    addressedTiles: u64(buf, 72),
    tileEntries: u64(buf, 80),
    tileContents: u64(buf, 88),
    clustered: buf[96] === 1,
    internalCompression: buf[97],
    tileCompression: buf[98],
    tileType: buf[99],
    minZoom: buf[100],
    maxZoom: buf[101],
    bounds: [e7(102), e7(106), e7(110), e7(114)],
    center: [e7(119), e7(123), buf[118]],
  };
}

function writeHeader(h) {
  const buf = Buffer.alloc(HEADER_BYTES);
  buf.write(MAGIC, 0, 'latin1');
  buf[7] = VERSION;
  const fields = ['rootOffset', 'rootLength', 'metadataOffset', 'metadataLength', 'leafOffset', 'leafLength', 'dataOffset', 'dataLength', 'addressedTiles', 'tileEntries', 'tileContents'];
  fields.forEach((f, i) => buf.writeBigUInt64LE(BigInt(h[f]), 8 + i * 8));
  buf[96] = 1;
  buf[97] = COMPRESSION.gzip;
  buf[98] = h.tileCompression;
  buf[99] = h.tileType;
  buf[100] = h.minZoom;
  buf[101] = h.maxZoom;
  const e7 = (v, at) => buf.writeInt32LE(Math.round(v * 1e7), at);
  h.bounds.forEach((v, i) => e7(v, 102 + i * 4));
  buf[118] = h.center[2];
  e7(h.center[0], 119);
  e7(h.center[1], 123);
  return buf;
}

export function decompress(buf, compression) {
  if (compression === COMPRESSION.none) return buf;
  if (compression === COMPRESSION.gzip) return gunzipSync(buf);
  throw new Error(`unsupported compression ${compression}`);
}

function directories(entries, rootLimit) {
  const root = gzipSync(encodeDirectory(entries), { level: 9 });
  if (HEADER_BYTES + root.length <= rootLimit) return { root, leaves: Buffer.alloc(0) };
  for (let size = 4096; ; size *= 2) {
    const chunks = [];
    for (let i = 0; i < entries.length; i += size) chunks.push(entries.slice(i, i + size));
    const leaves = chunks.map((c) => gzipSync(encodeDirectory(c), { level: 9 }));
    let offset = 0;
    const pointers = chunks.map((c, i) => {
      const p = { tileId: c[0].tileId, runLength: 0, length: leaves[i].length, offset };
      offset += leaves[i].length;
      return p;
    });
    const top = gzipSync(encodeDirectory(pointers), { level: 9 });
    if (HEADER_BYTES + top.length <= rootLimit) return { root: top, leaves: Buffer.concat(leaves) };
    if (chunks.length === 1) throw new Error(`root directory does not fit in ${rootLimit} bytes`);
  }
}

export function writeArchive({ tiles, metadata, tileCompression, tileType, bounds, center, rootLimit = ROOT_LIMIT }) {
  const sorted = [...tiles].sort((a, b) => a.id - b.id);
  if (sorted.length === 0) throw new Error('no tiles');
  sorted.forEach((t, i) => {
    if (i > 0 && t.id === sorted[i - 1].id) throw new Error(`tile ${t.id} given twice`);
  });
  const offsets = new Map();
  const chunks = [];
  let dataLength = 0;
  const entries = [];
  for (const t of sorted) {
    const key = t.data.toString('base64');
    let offset = offsets.get(key);
    if (offset === undefined) {
      offset = dataLength;
      offsets.set(key, offset);
      chunks.push(t.data);
      dataLength += t.data.length;
    }
    const last = entries.at(-1);
    if (last && last.offset === offset && last.tileId + last.runLength === t.id) last.runLength++;
    else entries.push({ tileId: t.id, runLength: 1, length: t.data.length, offset });
  }
  const { root, leaves } = directories(entries, rootLimit);
  const meta = gzipSync(JSON.stringify(metadata), { level: 9 });
  const zooms = sorted.map((t) => idToZxy(t.id).z);
  const header = writeHeader({
    rootOffset: HEADER_BYTES,
    rootLength: root.length,
    metadataOffset: HEADER_BYTES + root.length,
    metadataLength: meta.length,
    leafOffset: HEADER_BYTES + root.length + meta.length,
    leafLength: leaves.length,
    dataOffset: HEADER_BYTES + root.length + meta.length + leaves.length,
    dataLength,
    addressedTiles: sorted.length,
    tileEntries: entries.length,
    tileContents: chunks.length,
    tileCompression,
    tileType,
    minZoom: Math.min(...zooms),
    maxZoom: Math.max(...zooms),
    bounds,
    center,
  });
  return Buffer.concat([header, root, meta, leaves, ...chunks]);
}

export function* readTiles(buf) {
  const h = readHeader(buf);
  const slice = (offset, length) => {
    if (offset + length > buf.length) throw new Error('archive is truncated');
    return buf.subarray(offset, offset + length);
  };
  const dir = (offset, length) => decodeDirectory(decompress(slice(offset, length), h.internalCompression));
  function* walk(entries) {
    for (const e of entries) {
      if (e.runLength === 0) {
        yield* walk(dir(h.leafOffset + e.offset, e.length));
        continue;
      }
      const data = slice(h.dataOffset + e.offset, e.length);
      for (let k = 0; k < e.runLength; k++) yield { id: e.tileId + k, ...idToZxy(e.tileId + k), data };
    }
  }
  yield* walk(dir(h.rootOffset, h.rootLength));
}

export function readMetadata(buf) {
  const h = readHeader(buf);
  return JSON.parse(decompress(buf.subarray(h.metadataOffset, h.metadataOffset + h.metadataLength), h.internalCompression).toString('utf8'));
}
