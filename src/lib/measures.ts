import { getCollection } from 'astro:content';
import { home } from '../site';
import { defaultLang } from './i18n';
import { books } from './books';
import { songs } from './songs';
import { countsAsCity, countsAsCountry, distanceKm, localYear, takenAt, wordCount } from './measure';
import { seriesOf } from './photos';
import { districtCentres } from './districts';

export async function frames() {
  const [photos, centreOf] = await Promise.all([getCollection('photos'), districtCentres()]);
  return photos
    .map((photo) => {
      const centre = centreOf(photo.data.place);
      const at = takenAt(photo.data.taken, centre.timeZone);
      return {
        place: photo.data.place,
        series: seriesOf(photo),
        centre,
        at,
        year: localYear(at, centre.timeZone),
        km: Math.round(distanceKm(home, centre)),
      };
    })
    .sort((a, b) => a.at.getTime() - b.at.getTime());
}

export async function written() {
  return (await getCollection('writing')).map((entry) => ({
    year: entry.data.pubDate.getUTCFullYear(),
    words: wordCount(entry.body ?? ''),
  }));
}

export async function measures() {
  const [writing, shot, { finished }, { all: played }] = await Promise.all([
    written(),
    frames(),
    books(defaultLang),
    songs(defaultLang),
  ]);
  const cities = shot.filter((f) => countsAsCity(f.place, home));
  const farthest = shot
    .map((f) => ({ city: f.place.city, place: f.centre.id, km: f.km }))
    .reduce((a, b) => (b.km > a.km ? b : a));
  return {
    pages: {
      value: finished.reduce((n, b) => n + b.pages, 0),
      since: Math.min(...finished.map((b) => b.finished.getUTCFullYear())),
    },
    articles: writing.length,
    words: {
      value: writing.reduce((n, w) => n + w.words, 0),
      since: Math.min(...writing.map((w) => w.year)),
    },
    countries: new Set(shot.filter((f) => countsAsCountry(f.place, home)).map((f) => f.place.country)).size,
    cities: {
      value: new Set(cities.map((f) => `${f.place.city}, ${f.place.country}`)).size,
      latest: cities.at(-1)?.place.city,
    },
    frames: { value: shot.length, series: new Set(shot.map((f) => f.series)).size },
    farthest,
    languages: new Set(finished.map((b) => b.originalLanguage)).size,
    books: finished.length,
    songs: played.length,
  };
}
