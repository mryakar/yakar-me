import { getCollection } from 'astro:content';
import { home } from '../site';
import { books } from './books';
import { countsAsCity, countsAsCountry, distanceKm, takenAt, wordCount } from './measure';
import { seriesOf } from './photos';
import { districtCentres } from './districts';

export async function measures() {
  const [writing, photos, centreOf, { finished }] = await Promise.all([
    getCollection('writing'),
    getCollection('photos'),
    districtCentres(),
    books('en'),
  ]);
  const frames = photos
    .map((photo) => {
      const centre = centreOf(photo.data.place);
      return { place: photo.data.place, series: seriesOf(photo), centre, at: takenAt(photo.data.taken, centre.timeZone) };
    })
    .sort((a, b) => a.at.getTime() - b.at.getTime());
  const cities = frames.filter((f) => countsAsCity(f.place, home));
  const farthest = frames
    .map((f) => ({ city: f.place.city, place: f.centre.id, km: Math.round(distanceKm(home, f.centre)) }))
    .reduce((a, b) => (b.km > a.km ? b : a));
  return {
    pages: {
      value: finished.reduce((n, b) => n + b.pages, 0),
      since: Math.min(...finished.map((b) => b.finished.getUTCFullYear())),
    },
    words: {
      value: writing.reduce((n, entry) => n + wordCount(entry.body ?? ''), 0),
      since: Math.min(...writing.map((entry) => entry.data.pubDate.getUTCFullYear())),
    },
    countries: new Set(frames.filter((f) => countsAsCountry(f.place, home)).map((f) => f.place.country)).size,
    cities: {
      value: new Set(cities.map((f) => `${f.place.city}, ${f.place.country}`)).size,
      latest: cities.at(-1)?.place.city,
    },
    frames: { value: frames.length, series: new Set(frames.map((f) => f.series)).size },
    farthest,
    languages: new Set(finished.map((b) => b.originalLanguage)).size,
  };
}
