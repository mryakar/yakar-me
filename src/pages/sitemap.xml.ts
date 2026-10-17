import type { APIRoute } from 'astro';
import { articles } from '../lib/writing';
import { absoluteUrl, articlePath, isoDate } from '../lib/format';
import { allSeries } from '../lib/photos';
import { mapPath, seriesPath } from '../lib/photo';
import { defaultLang, localize, locales, type Lang } from '../lib/i18n';
import { paths } from '../site';

type Page = { path: string; langs: readonly Lang[]; lastmod?: Date };

export const GET: APIRoute = async () => {
  const [english, englishSeries] = await Promise.all([articles(defaultLang), allSeries(defaultLang)]);
  const pages: Page[] = [
    { path: paths.home, langs: locales, lastmod: english[0]?.pubDate },
    { path: paths.writing, langs: locales, lastmod: english[0]?.pubDate },
    { path: paths.reading, langs: locales },
    ...(englishSeries.length
      ? [
          { path: paths.photos, langs: locales },
          { path: mapPath(), langs: locales },
          ...englishSeries.map((s) => ({ path: seriesPath(s.id), langs: s.langs })),
        ]
      : []),
    { path: paths.playing, langs: locales },
    { path: paths.artists, langs: locales },
    { path: paths.about, langs: locales },
    { path: paths.years, langs: locales },
    ...english.map((a) => ({ path: articlePath(a.id), langs: a.langs, lastmod: a.pubDate })),
  ];
  const body = pages
    .flatMap((p) =>
      p.langs.map((lang) => {
        const links =
          p.langs.length > 1
            ? [...p.langs.map((l) => [l, localize(p.path, l)]), ['x-default', p.path]]
                .map(([l, href]) => `<xhtml:link rel="alternate" hreflang="${l}" href="${absoluteUrl(href)}"/>`)
                .join('')
            : '';
        const lastmod = p.lastmod ? `<lastmod>${isoDate(p.lastmod)}</lastmod>` : '';
        return `  <url><loc>${absoluteUrl(localize(p.path, lang))}</loc>${lastmod}${links}</url>`;
      }),
    )
    .join('\n');
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${body}\n</urlset>\n`,
    { headers: { 'Content-Type': 'application/xml; charset=utf-8' } },
  );
};
