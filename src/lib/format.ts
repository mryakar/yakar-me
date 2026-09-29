// Saf yardımcılar: Astro'ya bağımlı değil, testlerden doğrudan çağrılır.

const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Bir yazının sitedeki adresi. Adres biçimi yalnız burada tanımlı. */
export const articlePath = (id: string) => `/writing/${id}/`;

/** "16 September 2026" ya da "16 Sep 2026" (en-GB kısaltması "Sept" verir). */
export function formatDate(date: Date, month: 'long' | 'short' = 'long') {
  if (month === 'long') return date.toLocaleDateString('en-GB', { day: 'numeric', month, year: 'numeric', timeZone: 'UTC' });
  return `${date.getUTCDate()} ${SHORT_MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

/** "Sep 2026" */
export const formatMonth = (date: Date) => `${SHORT_MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;

/** "2026-09-16": <time datetime>, sitemap. */
export const isoDate = (date: Date) => date.toISOString().slice(0, 10);

/** Dakikada 240 kelime; kod blokları dahil. */
export function readingMinutes(body = '') {
  return Math.max(1, Math.round(body.split(/\s+/).filter(Boolean).length / 240));
}

/** XML metin ve öznitelik kaçışı. */
export const escapeXml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
