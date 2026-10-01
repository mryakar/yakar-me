import { test } from 'node:test';
import assert from 'node:assert/strict';
import { afterSunset, countsAsCity, countsAsCountry, distanceKm, odometer, sunAltitude, SUNSET_ALTITUDE, takenAt, wordCount } from '../src/lib/measure.ts';

const ankara = { lat: 39.9334, lon: 32.8597 };
const home = { city: 'Ankara', country: 'Turkey' };

function sunset(from, place) {
  let [a, b] = [from.getTime(), from.getTime() + 12 * 3600_000];
  for (let i = 0; i < 50; i++) {
    const m = (a + b) / 2;
    if (sunAltitude(new Date(m), place) > SUNSET_ALTITUDE) a = m;
    else b = m;
  }
  return a;
}

test('distanceKm: kuş uçuşu, Ankara → Causeway Bay 7.726 km', () => {
  assert.equal(Math.round(distanceKm(ankara, { lat: 22.28066, lon: 114.18096 })), 7726);
  assert.equal(distanceKm(ankara, ankara), 0);
});

test('sunAltitude: gün batımı yayımlanan saatlerle iki dakika içinde', () => {
  const cases = [
    ['2024-06-21T12:00:00Z', { lat: 51.5074, lon: -0.1278 }, '2024-06-21T20:21:00Z'],
    ['2024-06-20T17:00:00Z', { lat: 40.7128, lon: -74.006 }, '2024-06-21T00:31:00Z'],
  ];
  for (const [from, place, expected] of cases) {
    assert.ok(Math.abs(sunset(new Date(from), place) - Date.parse(expected)) < 2 * 60_000, expected);
  }
});

test('afterSunset: gün batımı ile doğuş arası', () => {
  const lamai = { lat: 9.46388, lon: 100.04166 };
  assert.equal(afterSunset(new Date('2026-05-22T18:52:00+07:00'), lamai), true);
  assert.equal(afterSunset(new Date('2026-05-22T15:00:00+07:00'), lamai), false);
  assert.equal(afterSunset(new Date('2026-05-23T03:00:00+07:00'), lamai), true);
});

test('takenAt: ofset varsa o anı, yoksa yerin saat dilimini kullanır', () => {
  assert.equal(takenAt('2026-05-20T21:04:00+08:00', 'Asia/Bangkok').toISOString(), '2026-05-20T13:04:00.000Z');
  assert.equal(takenAt('2026-05-20T21:04:00', 'Asia/Makassar').toISOString(), '2026-05-20T13:04:00.000Z');
  assert.equal(takenAt('2026-07-01T12:00:00', 'Europe/London').toISOString(), '2026-07-01T11:00:00.000Z');
  assert.equal(takenAt('2026-01-01T12:00:00', 'Europe/London').toISOString(), '2026-01-01T12:00:00.000Z');
});

test('countsAsCountry ve countsAsCity: ev, ülkesi ve şehir-devlet', () => {
  assert.equal(countsAsCountry({ city: 'Koh Samui', country: 'Thailand' }, home), true);
  assert.equal(countsAsCountry({ city: 'Istanbul', country: 'Turkey' }, home), false);
  assert.equal(countsAsCity({ city: 'Koh Samui', country: 'Thailand' }, home), true);
  assert.equal(countsAsCity({ city: 'Istanbul', country: 'Turkey' }, home), true);
  assert.equal(countsAsCity({ city: 'Ankara', country: 'Turkey' }, home), false);
  assert.equal(countsAsCity({ city: 'Hong Kong', country: 'Hong Kong' }, home), false);
});

test('wordCount: kod blokları, görseller ve adresler sayılmaz; satır içi kod ve bağlantı metni sayılır', () => {
  const md = [
    '## Why `equals` matters',
    '',
    "Don't override it [without hashCode](https://example.com/a-b) — compare-and-swap, e.g. twice.",
    '',
    '```java',
    'public boolean equals(Object o) { return true; }',
    '```',
    '',
    '- item',
    '  ~~~',
    '  hidden code',
    '  ~~~',
    '',
    '![A diagram](diagram.png "Caption")',
    'See https://example.org/path?x=1 and <https://example.net>.',
  ].join('\n');
  assert.equal(wordCount(md), 14);
  assert.equal(wordCount(''), 0);
});

test('odometer: sabit hücre, baştaki sıfırlar işaretli, sığmayan sayı büyür', () => {
  assert.deepEqual(odometer(19, 3), [
    { digit: 0, lead: true },
    { digit: 1, lead: false },
    { digit: 9, lead: false },
  ]);
  assert.deepEqual(odometer(0, 2), [
    { digit: 0, lead: true },
    { digit: 0, lead: false },
  ]);
  assert.equal(odometer(1234, 3).length, 4);
});
