import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  countsAsCity,
  countsAsCountry,
  distanceKm,
  localYear,
  odometer,
  readout,
  sum,
  takenAt,
  wordCount,
} from '../src/lib/measure.ts';

const ankara = { lat: 39.9334, lon: 32.8597 };
const home = { city: 'Ankara', country: 'Turkey' };

test('distanceKm: kuş uçuşu, Ankara → Causeway Bay 7.726 km', () => {
  assert.equal(Math.round(distanceKm(ankara, { lat: 22.28066, lon: 114.18096 })), 7726);
  assert.equal(distanceKm(ankara, ankara), 0);
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

test('localYear: yıl karenin yerindeki saate göre', () => {
  assert.equal(localYear(new Date('2025-12-31T20:00:00Z'), 'Asia/Makassar'), 2026);
  assert.equal(localYear(new Date('2025-12-31T20:00:00Z'), 'Europe/London'), 2025);
  assert.equal(localYear(takenAt('2026-01-01T00:30:00+03:00', 'Europe/Istanbul'), 'Europe/Istanbul'), 2026);
});

test('readout: rakamlar hücre, ayırıcı ayrı, iki dilde', () => {
  assert.deepEqual(readout('7,726'), [{ digit: 7 }, { separator: ',' }, { digit: 7 }, { digit: 2 }, { digit: 6 }]);
  assert.deepEqual(
    readout('10.013').map((c) => ('digit' in c ? c.digit : c.separator)),
    [1, 0, '.', 0, 1, 3],
  );
  assert.deepEqual(readout('9'), [{ digit: 9 }]);
});

test('sum: değerlerin toplamı, boş listede 0', () => {
  assert.equal(
    sum([{ pages: 120 }, { pages: 300 }], (b) => b.pages),
    420,
  );
  assert.equal(
    sum([], () => 1),
    0,
  );
});
