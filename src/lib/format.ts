const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const articlePath = (id: string) => `/writing/${id}/`;

export function formatDate(date: Date, month: 'long' | 'short' = 'long') {
  if (month === 'long') return date.toLocaleDateString('en-GB', { day: 'numeric', month, year: 'numeric', timeZone: 'UTC' });
  return `${date.getUTCDate()} ${SHORT_MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

export const formatMonth = (date: Date) => `${SHORT_MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;

export const isoDate = (date: Date) => date.toISOString().slice(0, 10);

export function readingMinutes(body = '') {
  return Math.max(1, Math.round(body.split(/\s+/).filter(Boolean).length / 240));
}

export const escapeXml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
