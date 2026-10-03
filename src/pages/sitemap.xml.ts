import type { APIRoute } from 'astro';
import { articles } from '../lib/writing';
import { articlePath, isoDate } from '../lib/format';
import { allSeries } from '../lib/photos';
import { mapPath, seriesPath } from '../lib/photo';
import { defaultLang, localize, locales, type Lang } from '../lib/i18n';

type Page = { path: string; langs: readonly Lang[]; lastmod?: Date };

export const GET: APIRoute = async ({ site: origin }) => {
  const base = origin!.toString().replace(/\/$/, '');
  const [written, series] = await Promise.all([
    Promise.all(locales.map(async (lang) => ({ lang, items: await articles(lang) }))),
    Promise.all(locales.map(async (lang) => ({ lang, items: await allSeries(lang) }))),
  ]);
  const inLangs = <T extends { id: string }>(all: { lang: Lang; items: T[] }[], id: string) =>
    all.filter((l) => l.items.some((i) => i.id === id)).map((l) => l.lang);
  const english = written.find((w) => w.lang === defaultLang)!.items;
  const englishSeries = series.find((s) => s.lang === defaultLang)!.items;
  const pages: Page[] = [
    { path: '/', langs: locales, lastmod: english[0]?.pubDate },
    { path: '/writing/', langs: locales, lastmod: english[0]?.pubDate },
    { path: '/reading/', langs: locales },
    ...(englishSeries.length
      ? [{ path: '/photos/', langs: locales }, { path: mapPath(), langs: locales }, ...englishSeries.map((s) => ({ path: seriesPath(s.id), langs: inLangs(series, s.id) }))]
      : []),
    { path: '/playing/', langs: locales },
    { path: '/playing/artists/', langs: locales },
    { path: '/about/', langs: locales },
    ...english.map((a) => ({ path: articlePath(a.id), langs: inLangs(written, a.id), lastmod: a.pubDate })),
  ];
  const body = pages
    .flatMap((p) =>
      p.langs.map((lang) => {
        const links =
          p.langs.length > 1
            ? [...p.langs.map((l) => [l, localize(p.path, l)]), ['x-default', p.path]]
                .map(([l, href]) => `<xhtml:link rel="alternate" hreflang="${l}" href="${base}${href}"/>`)
                .join('')
            : '';
        const lastmod = p.lastmod ? `<lastmod>${isoDate(p.lastmod)}</lastmod>` : '';
        return `  <url><loc>${base}${localize(p.path, lang)}</loc>${lastmod}${links}</url>`;
      }),
    )
    .join('\n');
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${body}\n</urlset>\n`,
    { headers: { 'Content-Type': 'application/xml; charset=utf-8' } },
  );
};
