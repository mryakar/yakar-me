import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gzipSync } from 'node:zlib';
import { randomBytes } from 'node:crypto';
import {
  COMPRESSION,
  TILE_TYPE,
  decodeDirectory,
  encodeDirectory,
  idToZxy,
  latToTileY,
  lonToTileX,
  readHeader,
  readTiles,
  tilesInBounds,
  writeArchive,
  zxyToId,
} from '../scripts/lib/pmtiles.mjs';

test('zxyToId: PMTiles belgesindeki ilk kimlikler', () => {
  assert.equal(zxyToId(0, 0, 0), 0);
  assert.deepEqual([[0, 0], [0, 1], [1, 1], [1, 0]].map(([x, y]) => zxyToId(1, x, y)), [1, 2, 3, 4]);
  assert.equal(zxyToId(2, 0, 0), 5);
  assert.equal(zxyToId(13, 0, 0), (4 ** 13 - 1) / 3);
});

test('zxyToId ve idToZxy: z0–6 her karede ve uç kimliklerde birbirinin tersi', () => {
  for (let z = 0; z <= 6; z++) {
    const n = 2 ** z;
    const seen = new Set();
    for (let x = 0; x < n; x++) {
      for (let y = 0; y < n; y++) {
        const id = zxyToId(z, x, y);
        seen.add(id);
        assert.deepEqual(idToZxy(id), { z, x, y });
      }
    }
    assert.equal(seen.size, n * n);
  }
  for (const [z, x, y] of [[13, 8191, 8191], [13, 6693, 3575], [26, 2 ** 26 - 1, 0]]) {
    assert.deepEqual(idToZxy(zxyToId(z, x, y)), { z, x, y });
  }
  assert.throws(() => zxyToId(1, 2, 0), RangeError);
});

test('tilesInBounds: Hong Kong z10, kenarlar kırpılır', () => {
  assert.equal(lonToTileX(114.17, 10), 836);
  assert.equal(latToTileY(22.3, 10), 446);
  assert.equal(lonToTileX(180, 3), 7);
  assert.equal(latToTileY(-89.9, 3), 7);
  const ids = tilesInBounds([113.82, 22.13, 114.45, 22.57], 10);
  assert.deepEqual(ids.map(idToZxy).map(({ x, y }) => `${x}/${y}`).sort(), ['835/446', '835/447', '836/446', '836/447', '837/446', '837/447']);
});

test('encodeDirectory ve decodeDirectory: ardışık ofset sıfırla yazılır, geri okunur', () => {
  const entries = [
    { tileId: 0, runLength: 1, length: 10, offset: 0 },
    { tileId: 1, runLength: 3, length: 20, offset: 10 },
    { tileId: 9, runLength: 1, length: 10, offset: 0 },
    { tileId: 300000000, runLength: 0, length: 5, offset: 2 ** 40 },
  ];
  const buf = encodeDirectory(entries);
  assert.deepEqual(decodeDirectory(buf), entries);
  assert.throws(() => decodeDirectory(Buffer.concat([buf, Buffer.from([0])])), /trailing/);
});

const tile = (z, x, y, body) => ({ id: zxyToId(z, x, y), data: gzipSync(Buffer.from(body)) });
const sample = [tile(0, 0, 0, 'world'), tile(1, 0, 0, 'sea'), tile(1, 0, 1, 'sea'), tile(1, 1, 1, 'land'), tile(1, 1, 0, 'sea')];
const archive = (tiles, rootLimit) =>
  writeArchive({
    tiles,
    metadata: { attribution: '© OpenStreetMap' },
    tileCompression: COMPRESSION.gzip,
    tileType: TILE_TYPE.mvt,
    bounds: [-180, -85, 180, 85],
    center: [0, 0, 0],
    rootLimit,
  });

test('writeArchive: aynı içerik bir kez yazılır, ardışık aynı karolar tek kayıt', () => {
  const buf = archive(sample);
  const h = readHeader(buf);
  assert.equal(h.addressedTiles, 5);
  assert.equal(h.tileEntries, 4);
  assert.equal(h.tileContents, 3);
  assert.equal(h.minZoom, 0);
  assert.equal(h.maxZoom, 1);
  assert.equal(h.leafLength, 0);
  assert.deepEqual(h.bounds, [-180, -85, 180, 85]);
  const read = [...readTiles(buf)].map(({ z, x, y, data }) => [`${z}/${x}/${y}`, data.equals(sample.find((t) => t.id === zxyToId(z, x, y)).data)]);
  assert.deepEqual(read, [['0/0/0', true], ['1/0/0', true], ['1/0/1', true], ['1/1/1', true], ['1/1/0', true]]);
});

test('writeArchive: kök sığmazsa yaprak dizinleri, karolar yine okunur', () => {
  const many = [];
  for (let x = 0; x < 64; x++) for (let y = 0; y < 64; y++) many.push(tile(6, x, y, randomBytes(1 + ((x * 64 + y) % 997)).toString('hex')));
  const buf = archive(many, 2000);
  const h = readHeader(buf);
  assert.ok(h.leafLength > 0);
  assert.ok(127 + h.rootLength <= 2000);
  assert.throws(() => archive(many, 140), /root directory/);
  const read = [...readTiles(buf)];
  assert.equal(read.length, 4096);
  assert.deepEqual(new Set(read.map((t) => t.id)), new Set(many.map((t) => t.id)));
});

test('writeArchive: aynı karo iki kez verilirse reddedilir; bozuk dosya okunmaz', () => {
  assert.throws(() => archive([sample[0], sample[0]]), /twice/);
  assert.throws(() => readHeader(Buffer.from('not an archive at all'.padEnd(200))), /not a PMTiles/);
  const buf = archive(sample);
  assert.throws(() => [...readTiles(buf.subarray(0, buf.length - 3))], /truncated/);
});
