import { taxonomy } from './taxonomy.ts';

export const genres = {
  'smooth-jazz': ['smooth-jazz'],
  jazz: ['bossa-nova', 'soul-jazz'],
  'pop-rock': ['pop', 'sophisti-pop', 'rock'],
  electronic: ['deep-house', 'electronica'],
  folk: ['celtic-folk'],
} as const;

export type Category = keyof typeof genres;
export type Genre = (typeof genres)[Category][number];

export const { categories, allGenres, categoryOf } = taxonomy<Category, Genre>(genres);

export const categoryClass: Record<Category, string> = {
  'smooth-jazz': 'music-smooth-jazz',
  jazz: 'music-jazz',
  'pop-rock': 'music-pop-rock',
  electronic: 'music-electronic',
  folk: 'music-folk',
};

export const LEVELS = 5;
export const SLEEVE_LAYOUTS = 3;

export const PITCHES = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'] as const;
export const keys = PITCHES.flatMap((p) => [p, `${p}m`]);
const ALTO_SHIFT = 9;
const FIFTHS = [0, 7, 2, 9, 4, 11, 6, 1, 8, 3, 10, 5];

const pitchClass = (n: number) => ((n % 12) + 12) % 12;
const keyName = (pitch: number, minor: boolean) => `${PITCHES[pitchClass(pitch)]}${minor ? 'm' : ''}`;

export function parseKey(key: string) {
  const minor = key.endsWith('m');
  const pitch = PITCHES.indexOf((minor ? key.slice(0, -1) : key) as (typeof PITCHES)[number]);
  if (pitch < 0) throw new Error(`Unknown key "${key}"`);
  return { pitch, minor };
}

export function altoKey(concert: string) {
  const { pitch, minor } = parseKey(concert);
  return keyName(pitch + ALTO_SHIFT, minor);
}

export function fifthsPosition(key: string) {
  const { pitch, minor } = parseKey(key);
  return FIFTHS.indexOf(pitchClass(minor ? pitch + 3 : pitch));
}

export const circleOfFifths = FIFTHS.map((pitch) => ({ major: keyName(pitch, false), minor: keyName(pitch + ALTO_SHIFT, true) }));

export function keyTally(concertKeys: string[]) {
  const counts = circleOfFifths.map(() => 0);
  for (const key of concertKeys) counts[fifthsPosition(key)]++;
  const most = Math.max(...counts);
  return { counts, most, top: counts.indexOf(most) };
}

export const sleeveLayout = (position: number) => position % SLEEVE_LAYOUTS;

export const catalogNumber = (position: number) => `YKR-${String(position + 1).padStart(3, '0')}`;

export function initials(name: string) {
  return name
    .replace(/^The /, '')
    .split(/[\s&]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join('');
}

export function slugify(name: string) {
  return name
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function roman(n: number) {
  const table: [number, string][] = [[10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
  let out = '';
  for (const [value, symbol] of table) for (; n >= value; n -= value) out += symbol;
  return out;
}

export function rankArtists<T extends { artist: string }>(songs: T[]) {
  const byArtist = new Map<string, T[]>();
  for (const song of songs) byArtist.set(song.artist, [...(byArtist.get(song.artist) ?? []), song]);
  return [...byArtist]
    .map(([name, list]) => ({ name, songs: list }))
    .sort((a, b) => b.songs.length - a.songs.length || a.name.localeCompare(b.name, 'en'));
}

export const recentFirst = <T extends { firstPlayed?: string; position: number }>(songs: T[]) =>
  songs.toSorted((a, b) => (b.firstPlayed ?? '').localeCompare(a.firstPlayed ?? '') || a.position - b.position);

const monthIndex = (month: string) => {
  const [y, m] = month.split('-').map(Number);
  return y * 12 + m - 1;
};

export function staffLayout<T extends { firstPlayed: string; key: string }>(songs: T[]) {
  if (songs.length === 0) return null;
  const years = songs.map((s) => Number(s.firstPlayed.slice(0, 4)));
  const from = Math.min(...years);
  const to = Math.max(...years);
  const start = from * 12;
  const span = (to - from + 1) * 12 - 1 || 1;
  return {
    years: Array.from({ length: to - from + 1 }, (_, i) => ({ year: from + i, x: (i * 12) / span })),
    notes: songs.map((song) => ({ song, x: (monthIndex(song.firstPlayed) - start) / span, step: parseKey(song.key).pitch / 11 })),
  };
}
