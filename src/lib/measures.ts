import { getCollection } from 'astro:content';
import { home } from '../site';
import { books } from './books';
import { afterSunset, countsAsCity, countsAsCountry, distanceKm, takenAt, wordCount } from './measure';
import { seriesOf } from './photos';

const key = (p: { district: string; city: string; country: string }) => `${p.district}, ${p.city}, ${p.country}`;

export async function measures() {
  const [writing, photos, districts, { finished }] = await Promise.all([
    getCollection('writing'),
    getCollection('photos'),
    getCollection('districts'),
    books('en'),
  ]);
  const centres = new Map(districts.map(({ data }) => [key(data), data]));
  const frames = photos
    .map((photo) => {
      const centre = centres.get(key(photo.data.place));
      if (!centre) throw new Error(`No district centre for "${key(photo.data.place)}" — add it to src/content/districts.json`);
      return { place: photo.data.place, series: seriesOf(photo), centre, at: takenAt(photo.data.taken, centre.timeZone) };
    })
    .sort((a, b) => a.at.getTime() - b.at.getTime());
  const cities = frames.filter((f) => countsAsCity(f.place, home));
  const farthest = frames
    .map((f) => ({ city: f.place.city, km: Math.round(distanceKm(home, f.centre)) }))
    .reduce((a, b) => (b.km > a.km ? b : a));
  const night = frames.map((f) => afterSunset(f.at, f.centre));
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
    frames: { value: frames.length, series: new Set(frames.map((f) => f.series)).size, night },
    afterSunset: night.filter(Boolean).length,
    farthest,
    languages: new Set(finished.map((b) => b.originalLanguage)).size,
  };
}
