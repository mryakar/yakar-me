import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bounds, boundsMiddle, centre, cityKey, contains, padded, placeKey, regionProblems, regions, tileRoot } from '../src/lib/map.ts';

const hk = (district, lat, lon) => ({ district, city: 'Hong Kong', country: 'Hong Kong', lat, lon });
const causeway = hk('Causeway Bay', 22.28066, 114.18096);
const mongKok = hk('Mong Kok', 22.3225, 114.17056);
const ubud = { district: 'Ubud', city: 'Bali', country: 'Indonesia', lat: -8.5069, lon: 115.2625 };

test('anahtarlar ve karo kökü', () => {
  assert.equal(placeKey(causeway), 'Causeway Bay, Hong Kong, Hong Kong');
  assert.equal(cityKey(ubud), 'Bali, Indonesia');
  assert.equal(tileRoot('5911747e0123456789'), '/tiles/5911747e/');
});

test('bounds ve boundsMiddle: noktaların kutusu ve ortası', () => {
  assert.deepEqual(bounds([causeway, mongKok]), [114.17056, 22.28066, 114.18096, 22.3225]);
  assert.deepEqual(boundsMiddle([causeway, mongKok]), { lat: (22.28066 + 22.3225) / 2, lon: (114.17056 + 114.18096) / 2 });
  assert.throws(() => bounds([]), /no points/);
});

test('padded: kutu her yöne km kadar büyür, Mercator sınırında durur', () => {
  const [w, s, e, n] = padded([causeway], 10);
  assert.ok(Math.abs(n - s - 20 / 111.32) < 1e-4);
  assert.ok(Math.abs((e - w) * 111.32 * Math.cos((n * Math.PI) / 180) - 20) < 0.1);
  assert.ok(contains([w, s, e, n], causeway));
  assert.deepEqual(padded([{ lat: 84.99, lon: 179.99 }], 10).slice(2), [180, 85]);
});

test('regions: şehir başına bir kutu, ülke ve şehir adına göre sıralı', () => {
  const r = regions([mongKok, ubud, causeway]);
  assert.deepEqual(r.map(cityKey), ['Hong Kong, Hong Kong', 'Bali, Indonesia']);
  assert.ok([causeway, mongKok].every((d) => contains(r[0].bounds, d)));
  assert.ok(!contains(r[0].bounds, ubud));
});

test('regionProblems: eksik şehir, kutu dışında semt ve fotoğrafsız şehir', () => {
  const cut = regions([causeway]);
  assert.deepEqual(regionProblems([causeway], cut), []);
  assert.deepEqual(regionProblems([causeway, hk('Tai O', 22.25, 113.86), ubud], cut), [
    'Tai O, Hong Kong, Hong Kong lies outside the tiles cut for Hong Kong, Hong Kong',
    'Bali, Indonesia has photos but no map tiles',
  ]);
  assert.deepEqual(regionProblems([], cut), ['tiles are cut for Hong Kong, Hong Kong, which has no photos']);
});

test('centre: küre üstünde ortalama nokta', () => {
  assert.deepEqual(centre([{ lat: 0, lon: 170 }, { lat: 0, lon: -170 }]), { lat: 0, lon: 180 });
  assert.deepEqual(centre([{ lat: 10, lon: 20 }]), { lat: 10, lon: 20 });
});
