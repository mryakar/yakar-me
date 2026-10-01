import { site } from '../site.ts';
import { dateLocale, localize, type Lang } from './i18n.ts';

const SHORT_MONTHS: Record<Lang, string[]> = {
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  tr: ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'],
};

export const articlePath = (id: string, lang: Lang = 'en') => localize(`/writing/${id}/`, lang);

export function formatDate(date: Date, month: 'long' | 'short' = 'long', lang: Lang = 'en') {
  if (month === 'long') {
    return date.toLocaleDateString(dateLocale[lang], { day: 'numeric', month, year: 'numeric', timeZone: 'UTC' });
  }
  return `${date.getUTCDate()} ${SHORT_MONTHS[lang][date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

export const shortMonth = (date: Date, lang: Lang = 'en') => SHORT_MONTHS[lang][date.getUTCMonth()];

export const formatMonth = (date: Date, lang: Lang = 'en') => `${shortMonth(date, lang)} ${date.getUTCFullYear()}`;

export const monthYear = (date: Date, lang: Lang = 'en') =>
  date.toLocaleDateString(dateLocale[lang], { month: 'long', year: 'numeric', timeZone: 'UTC' });

export function englishOrdinal(n: number) {
  const teen = n % 100 >= 11 && n % 100 <= 13;
  const suffix = teen ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th';
  return `${n}${suffix}`;
}

export const plural = (forms: { one: string; other: string }, n: number) => (n === 1 ? forms.one : forms.other).replace('{n}', String(n));

export const documentTitle = (...parts: string[]) => [...parts, site.title].join(' — ');

export const isoDate = (date: Date) => date.toISOString().slice(0, 10);

export function readingMinutes(body = '') {
  return Math.max(1, Math.round(body.split(/\s+/).filter(Boolean).length / 240));
}

export const escapeXml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
