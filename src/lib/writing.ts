import { getCollection, type CollectionEntry } from 'astro:content';

export type Article = CollectionEntry<'writing'>;

// Raflar konuya göre (sitede seri kodu görünmez).
export const topics = ['Java', 'Databases'] as const;

/** En yeni önce. */
export async function articles(): Promise<Article[]> {
  return (await getCollection('writing')).sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());
}

const SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "16 September 2026" ya da "16 Sep 2026" (en-GB kısaltması "Sept" verir). */
export function formatDate(date: Date, month: 'long' | 'short' = 'long') {
  if (month === 'long') return date.toLocaleDateString('en-GB', { day: 'numeric', month, year: 'numeric', timeZone: 'UTC' });
  return `${date.getUTCDate()} ${SHORT[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

/** "Sep 2026" */
export function formatMonth(date: Date) {
  return `${SHORT[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

/** Dakikada 240 kelime; kod blokları dahil. */
export function readingMinutes(body = '') {
  return Math.max(1, Math.round(body.split(/\s+/).filter(Boolean).length / 240));
}
