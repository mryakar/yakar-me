import type { APIRoute } from 'astro';
import { articles } from '../lib/writing';
import { articlePath, isoDate } from '../lib/format';

export const GET: APIRoute = async ({ site: origin }) => {
  const base = origin!.toString().replace(/\/$/, '');
  const all = await articles();
  const urls = [
    { loc: '/', lastmod: all[0]?.data.pubDate },
    { loc: '/writing/', lastmod: all[0]?.data.pubDate },
    { loc: '/about/' },
    ...all.map((a) => ({ loc: articlePath(a.id), lastmod: a.data.pubDate })),
  ];
  const body = urls
    .map((u) => `  <url><loc>${base}${u.loc}</loc>${u.lastmod ? `<lastmod>${isoDate(u.lastmod)}</lastmod>` : ''}</url>`)
    .join('\n');
  return new Response(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
};
