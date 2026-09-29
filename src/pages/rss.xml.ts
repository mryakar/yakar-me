import type { APIRoute } from 'astro';
import { site } from '../site';
import { articles } from '../lib/writing';
import { articlePath, escapeXml as esc } from '../lib/format';

// RSS 2.0, bağımlılıksız. Yazının tamamı sitede: akışta başlık, özet ve bağlantı.
export const GET: APIRoute = async ({ site: origin }) => {
  const base = origin!.toString().replace(/\/$/, '');
  const items = (await articles())
    .map((a) => {
      const url = base + articlePath(a.id);
      return `    <item>
      <title>${esc(a.data.title)}</title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <description>${esc(a.data.description)}</description>
      <category>${esc(a.data.topic)}</category>
      <pubDate>${a.data.pubDate.toUTCString()}</pubDate>
    </item>`;
    })
    .join('\n');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${esc(site.name)}</title>
    <link>${base}/</link>
    <description>${esc(site.description)}</description>
    <language>en</language>
    <atom:link href="${base}/rss.xml" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>
`;
  return new Response(xml, { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' } });
};
