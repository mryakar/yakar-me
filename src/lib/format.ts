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

export const formatMonth = (date: Date, lang: Lang = 'en') => `${SHORT_MONTHS[lang][date.getUTCMonth()]} ${date.getUTCFullYear()}`;

export const isoDate = (date: Date) => date.toISOString().slice(0, 10);

export function readingMinutes(body = '') {
  return Math.max(1, Math.round(body.split(/\s+/).filter(Boolean).length / 240));
}

export const escapeXml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
