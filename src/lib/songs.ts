import { getCollection, type CollectionEntry } from 'astro:content';
import type { Lang } from './i18n';
import { catalogNumber, recentFirst, sleeveLayout, slugify } from './song';

type Entry = CollectionEntry<'songs'>['data'];

function song(entry: Entry, lang: Lang) {
  return {
    id: entry.id,
    title: entry.title,
    artist: entry.artist,
    artistId: slugify(entry.artist),
    lang: entry.lang,
    album: entry.album,
    year: entry.year,
    category: entry.category,
    genre: entry.genre,
    level: entry.level,
    key: entry.key,
    keyEstimated: entry.keyEstimated === true,
    firstPlayed: entry.firstPlayed,
    links: entry.links,
    catalog: catalogNumber(entry.position),
    sleeve: sleeveLayout(entry.position),
    position: entry.position,
    practicing: entry.status === 'practicing',
    nowNote: entry.status === 'practicing' ? entry.nowNote?.[lang] : undefined,
  };
}

export type Song = ReturnType<typeof song>;

export async function songs(lang: Lang) {
  const entries = (await getCollection('songs')).map((e) => e.data).toSorted((a, b) => a.position - b.position);
  if (entries.length === 0) throw new Error('src/content/songs.json has no songs');
  const all = entries.map((e) => song(e, lang));
  return { all: recentFirst(all), practicing: all.filter((s) => s.practicing) };
}
