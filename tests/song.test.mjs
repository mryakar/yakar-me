import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  allGenres,
  altoKey,
  catalogNumber,
  categories,
  categoryClass,
  categoryOf,
  circleOfFifths,
  fifthsPosition,
  genres,
  initials,
  keys,
  keyTally,
  LEVELS,
  parseKey,
  rankArtists,
  recentFirst,
  roman,
  sleeveLayout,
  SLEEVE_LAYOUTS,
  slugify,
  staffLayout,
} from '../src/lib/song.ts';
import { ui } from '../src/i18n/ui.ts';

const songs = JSON.parse(readFileSync(new URL('../src/content/songs.json', import.meta.url), 'utf8'));
const css = readFileSync(new URL('../src/styles/global.css', import.meta.url), 'utf8');

test('her türün tek bir kategorisi var', () => {
  assert.equal(new Set(allGenres).size, allGenres.length);
  for (const c of categories) for (const g of genres[c]) assert.equal(categoryOf(g), c);
});

test('altoKey: konser tonundan büyük altılı yukarı', () => {
  assert.equal(altoKey('Dm'), 'Bm');
  assert.equal(altoKey('Cm'), 'Am');
  assert.equal(altoKey('Am'), 'F♯m');
  assert.equal(altoKey('D♭m'), 'B♭m');
  assert.equal(altoKey('F'), 'D');
  assert.equal(altoKey('E♭'), 'C');
});

test('parseKey: bilinmeyen ton hata verir', () => {
  assert.deepEqual(parseKey('B♭m'), { pitch: 10, minor: true });
  assert.throws(() => parseKey('H'));
  assert.throws(() => parseKey('C#m'));
  assert.equal(keys.length, 24);
});

test('beşliler çemberi: paralel minör aynı dilimde', () => {
  assert.equal(circleOfFifths[0].major, 'C');
  assert.equal(circleOfFifths[0].minor, 'Am');
  assert.equal(circleOfFifths[11].major, 'F');
  assert.equal(circleOfFifths[11].minor, 'Dm');
  assert.equal(fifthsPosition('Dm'), fifthsPosition('F'));
  assert.equal(fifthsPosition('D♭m'), fifthsPosition('E'));
  for (const k of keys) assert.ok(fifthsPosition(k) >= 0, k);
});

test('keyTally: dilim sayıları ve en sık dilim', () => {
  const { counts, most, top } = keyTally(['Dm', 'F', 'Dm', 'Cm']);
  assert.equal(most, 3);
  assert.equal(circleOfFifths[top].minor, 'Dm');
  assert.equal(counts.reduce((a, b) => a + b), 4);
});

test('kılıf düzeni ve katalog numarası dosyadaki konumdan, sabit', () => {
  assert.deepEqual([0, 1, 2, 3].map(sleeveLayout), [0, 1, 2, 0]);
  for (let i = 0; i < 30; i++) assert.ok(sleeveLayout(i) < SLEEVE_LAYOUTS);
  assert.equal(catalogNumber(0), 'YKR-001');
  assert.equal(catalogNumber(41), 'YKR-042');
});

test('initials: ilk iki sözcüğün baş harfi', () => {
  assert.equal(initials('Grover Washington, Jr.'), 'GW');
  assert.equal(initials('Les McCann & Eddie Harris'), 'LM');
  assert.equal(initials('Sade'), 'S');
  assert.equal(initials('The Beatles'), 'B');
});

test('slugify: işaretler düşer, adres güvenli', () => {
  assert.equal(slugify('Grover Washington, Jr.'), 'grover-washington-jr');
  assert.equal(slugify('Les McCann & Eddie Harris'), 'les-mccann-eddie-harris');
  assert.equal(slugify('Antônio Carlos Jobim'), 'antonio-carlos-jobim');
});

test('roman', () => {
  assert.deepEqual([1, 4, 5, 9, 14, 39].map(roman), ['I', 'IV', 'V', 'IX', 'XIV', 'XXXIX']);
});

test('rankArtists: şarkı sayısı, eşitlikte ad sırası', () => {
  const ranked = rankArtists([{ artist: 'B' }, { artist: 'A' }, { artist: 'C' }, { artist: 'C' }]);
  assert.deepEqual(ranked.map((a) => [a.name, a.songs.length]), [['C', 2], ['A', 1], ['B', 1]]);
});

test('recentFirst: ilk çalınış yeniden eskiye, ayı olmayan sonda, sonra dosya sırası', () => {
  const list = [
    { id: 'a', position: 0 },
    { id: 'b', firstPlayed: '2025-03', position: 1 },
    { id: 'c', position: 2 },
    { id: 'd', firstPlayed: '2026-01', position: 3 },
  ];
  assert.deepEqual(recentFirst(list).map((s) => s.id), ['d', 'b', 'a', 'c']);
});

test('staffLayout: yıllar ve notalar 0–1 aralığında', () => {
  assert.equal(staffLayout([]), null);
  const layout = staffLayout([
    { firstPlayed: '2024-01', key: 'C' },
    { firstPlayed: '2026-12', key: 'B' },
  ]);
  assert.deepEqual(layout.years.map((y) => y.year), [2024, 2025, 2026]);
  assert.equal(layout.notes[0].x, 0);
  assert.equal(layout.notes[1].x, 1);
  assert.equal(layout.notes[0].step, 0);
  assert.equal(layout.notes[1].step, 1);
});

test('şarkı verisi: tekil kimlik, türüne uyan kategori, ölçekte seviye, bilinen ton', () => {
  assert.equal(new Set(songs.map((s) => s.id)).size, songs.length);
  for (const s of songs) {
    assert.equal(categoryOf(s.genre), s.category, s.id);
    assert.ok(s.level >= 1 && s.level <= LEVELS, s.id);
    assert.ok(keys.includes(s.key), s.id);
    assert.equal(s.nowNote === undefined || s.status === 'practicing', true, s.id);
  }
});

test('kategori ve tür adları iki dilde tam; seviye adları ölçek kadar', () => {
  for (const lang of ['en', 'tr']) {
    const t = ui[lang].playing;
    for (const c of categories) assert.ok(t.categories[c], `${lang} ${c}`);
    for (const g of allGenres) assert.ok(t.genreNames[g], `${lang} ${g}`);
    assert.equal(t.levels.length, LEVELS, lang);
  }
});

test('her kategorinin rengi CSS\'te tanımlı', () => {
  for (const c of categories) {
    assert.match(css, new RegExp(`\\.${categoryClass[c]} \\{`), c);
    for (const token of ['music', 'ink', 'paper']) assert.match(css, new RegExp(`--yk-${token}-${c}:`), `${token} ${c}`);
  }
});
