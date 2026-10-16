import { home } from '../site';
import { books } from './books';
import { countsAsCity, countsAsCountry, sum } from './measure';
import { frames, written } from './measures';
import { byMonth, peak, yearsDescending } from './year';
import type { Lang } from './i18n';

export async function years(lang: Lang, today = new Date()) {
  const [{ reading, finished }, shot, writing] = await Promise.all([books(lang), frames(), written()]);
  const current = today.getUTCFullYear();
  const first = Math.min(...finished.map((b) => b.finished.getUTCFullYear()), ...shot.map((f) => f.year), ...writing.map((w) => w.year));
  const rows = yearsDescending(first, current).map((year) => {
    const read = finished.filter((b) => b.finished.getUTCFullYear() === year);
    const unfinished = year === current ? reading : [];
    const took = shot.filter((f) => f.year === year);
    const away = took.filter((f) => countsAsCountry(f.place, home));
    const far = peak(took, (f) => f.km);
    const wrote = writing.filter((w) => w.year === year);
    return {
      year,
      empty: read.length + unfinished.length + took.length + wrote.length === 0,
      books: {
        count: read.length,
        pages: sum(read, (b) => b.pages),
        months: byMonth(read, (b) => b.finished.getUTCMonth()),
        reading: unfinished,
        lastMonth: year === current ? today.getUTCMonth() : 11,
      },
      frames: {
        count: took.length,
        cities: [...new Set(away.filter((f) => countsAsCity(f.place, home)).map((f) => f.place.city))],
        countries: new Set(away.map((f) => f.place.country)).size,
      },
      farthest: far && { km: far.km, city: far.place.city },
      writing: { count: wrote.length, words: sum(wrote, (w) => w.words) },
    };
  });
  return {
    rows,
    peaks: {
      books: peak(rows, (r) => r.books.count)?.year,
      frames: peak(rows, (r) => r.frames.count)?.year,
      farthest: peak(rows, (r) => r.farthest?.km ?? 0)?.year,
      words: peak(rows, (r) => r.writing.words)?.year,
    },
  };
}
