import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mapStyle, PALETTE_TOKENS } from '../src/lib/map-style.ts';
import { arrange, LABEL_OFFSET, MERGE_PX } from '../src/lib/map-labels.ts';

const palette = Object.fromEntries(PALETTE_TOKENS.map((t, i) => [t, `rgb(${i}, 0, 0)`]));
const input = (over = {}) => ({
  palette,
  lang: 'en',
  origin: 'https://yakar.me',
  tiles: '/tiles/abcd1234/{z}/{x}/{y}.mvt',
  worldMaxZoom: 6,
  cityZooms: [7, 13],
  regions: [[114, 22, 114.3, 22.4], [115, -9, 115.6, -8]],
  ours: ['Hong Kong', 'Mong Kok'],
  ...over,
});

test('mapStyle: dünya + şehir başına kaynak, kutu ve yakınlık sınırları, adres şablonu bozulmaz', () => {
  const s = mapStyle(input());
  assert.deepEqual(Object.keys(s.sources), ['world', 'city-0', 'city-1']);
  assert.deepEqual(s.sources.world, { type: 'vector', tiles: ['https://yakar.me/tiles/abcd1234/{z}/{x}/{y}.mvt'], minzoom: 0, maxzoom: 6 });
  assert.deepEqual(s.sources['city-1'].bounds, [115, -9, 115.6, -8]);
  assert.equal(s.sources['city-0'].minzoom, 7);
  assert.equal(s.sources['city-0'].maxzoom, 13);
  assert.equal(s.glyphs, 'https://yakar.me/glyphs/{fontstack}/{range}.pbf');
  assert.deepEqual(s.projection, { type: 'globe' });
});

test('mapStyle: yazılar en sonda, renkler paletten, bizim adlarımız altlıkta yok', () => {
  const s = mapStyle(input());
  const symbols = s.layers.map((l) => l.type === 'symbol');
  assert.ok(symbols.indexOf(true) > symbols.lastIndexOf(false));
  assert.equal(s.layers.find((l) => l.id === 'world-earth').paint['fill-color'], palette.land);
  const localities = s.layers.find((l) => l.id === 'city-0-localities');
  assert.deepEqual(localities.filter.at(-1), ['!', ['in', ['get', 'name:en'], ['literal', ['Hong Kong', 'Mong Kok']]]]);
  assert.deepEqual(localities.layout['text-font'], ['instrument-serif-italic']);
  assert.ok(!s.layers.some((l) => l.id.startsWith('world-roads')));
});

test('mapStyle: Türkçe sayfada önce name:tr, sonra name:en; yerel yazıya düşülmez', () => {
  const tr = mapStyle(input({ lang: 'tr' })).layers.find((l) => l.id === 'countries').layout['text-field'];
  assert.deepEqual(tr, ['coalesce', ['get', 'name:tr'], ['get', 'name:en']]);
  assert.deepEqual(mapStyle(input()).layers.find((l) => l.id === 'countries').layout['text-field'], ['get', 'name:en']);
});

const spot = (x, y, weight, width = 60) => ({ x, y, weight, width, height: 16 });

test('arrange: yakın noktalar ağır olana katılır', () => {
  const r = arrange([spot(100, 100, 3), spot(100 + MERGE_PX - 1, 100, 11), spot(300, 100, 1)], 800);
  assert.deepEqual(r.map((a) => a.leader), [1, 1, 2]);
  assert.equal(r[0].side, null);
  assert.equal(r[1].side, 'right');
});

test('arrange: sağa sığmayan etiket sola; komşu noktayı örten ya da hiçbir yana sığmayan gizlenir', () => {
  assert.equal(arrange([spot(790, 100, 1)], 800)[0].side, 'left');
  const r = arrange([spot(100, 100, 5, 200), spot(100 + MERGE_PX + 1, 100, 1, 200)], 800);
  assert.deepEqual(r.map((a) => a.side), [null, 'right']);
  assert.equal(arrange([spot(100, 100, 1, 2000)], 800)[0].side, null);
  assert.equal(LABEL_OFFSET, 20);
});
