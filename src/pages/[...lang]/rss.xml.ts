import type { APIRoute } from 'astro';
import { site } from '../../site';
import { ui } from '../../i18n/ui';
import { langPaths, localize, type Lang } from '../../lib/i18n';
import { articles } from '../../lib/writing';
import { articlePath, escapeXml as esc } from '../../lib/format';

export const getStaticPaths = langPaths;

export const GET: APIRoute = async ({ props, site: origin }) => {
  const { lang } = props as { lang: Lang };
  const t = ui[lang];
  const base = origin!.toString().replace(/\/$/, '');
  const items = (await articles(lang))
    .map((a) => {
      const url = base + articlePath(a.id, lang);
      return `    <item>
      <title>${esc(a.title)}</title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <description>${esc(a.description)}</description>
      <category>${esc(t.writing.topics[a.topic])}</category>
      <pubDate>${a.pubDate.toUTCString()}</pubDate>
    </item>`;
    })
    .join('\n');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${esc(site.name)}</title>
    <link>${base}${localize('/', lang)}</link>
    <description>${esc(t.description)}</description>
    <language>${lang}</language>
    <atom:link href="${base}${localize('/rss.xml', lang)}" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>
`;
  return new Response(xml, { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' } });
};
