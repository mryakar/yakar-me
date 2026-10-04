import { escapeXml as esc } from './format.ts';

export interface FeedImage {
  url: string;
  type: string;
  bytes: number;
}

export interface FeedItem {
  title: string;
  url: string;
  description: string;
  content: string;
  category: string;
  date: Date;
  image?: FeedImage;
}

export interface FeedChannel {
  title: string;
  url: string;
  self: string;
  description: string;
  language: string;
}

const hasScheme = (url: string) => /^[a-z][a-z0-9+.-]*:/i.test(url);
const absolute = (url: string, page: string) => (hasScheme(url) ? url : new URL(url, page).toString());

export const absoluteUrls = (html: string, page: string) =>
  html
    .replace(/(\s(?:href|src)=")([^"]*)"/g, (_, attr: string, url: string) => `${attr}${absolute(url, page)}"`)
    .replace(/(\ssrcset=")([^"]*)"/g, (_, attr: string, set: string) => {
      const candidates = set.split(',').map((c) => {
        const [url, ...descriptors] = c.trim().split(/\s+/);
        return [absolute(url, page), ...descriptors].join(' ');
      });
      return `${attr}${candidates.join(', ')}"`;
    });

export const newestFirst = (items: FeedItem[]) => [...items].sort((a, b) => b.date.valueOf() - a.date.valueOf());

export function rssItem(item: FeedItem) {
  const enclosure = item.image
    ? `\n      <enclosure url="${esc(item.image.url)}" length="${item.image.bytes}" type="${esc(item.image.type)}" />`
    : '';
  return `    <item>
      <title>${esc(item.title)}</title>
      <link>${esc(item.url)}</link>
      <guid isPermaLink="true">${esc(item.url)}</guid>
      <description>${esc(item.description)}</description>
      <content:encoded>${esc(item.content)}</content:encoded>
      <category>${esc(item.category)}</category>
      <pubDate>${item.date.toUTCString()}</pubDate>${enclosure}
    </item>`;
}

export const rssFeed = (channel: FeedChannel, items: FeedItem[]) => `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>${esc(channel.title)}</title>
    <link>${esc(channel.url)}</link>
    <description>${esc(channel.description)}</description>
    <language>${esc(channel.language)}</language>
    <atom:link href="${esc(channel.self)}" rel="self" type="application/rss+xml" />
${newestFirst(items).map(rssItem).join('\n')}
  </channel>
</rss>
`;
