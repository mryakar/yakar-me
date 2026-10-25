import { site, paths } from '../site';
import { bilingual, ui } from '../i18n/ui';
import { localize, type Lang } from './i18n';
import { articles } from './writing';
import { allSeries } from './photos';
import { seriesPath, smallestAtLeast, variantPath } from './photo';
import { absoluteUrls, rssFeed, type FeedItem } from './feed';
import { absoluteUrl, articlePath, escapeXml as esc } from './format';
import { htmlRenderer } from './rendered';

const FEED_IMAGE_WIDTH = 1280;
const FEED_ICON_SIZE = 144;

const translationNote = (lang: Lang, original: Lang, path: string) =>
  original === lang ? '' : `<p><a href="${absoluteUrl(path)}">${esc(bilingual.translated.title(original))}</a></p>\n`;

export async function writingItems(lang: Lang): Promise<FeedItem[]> {
  const t = ui[lang];
  const body = await htmlRenderer();
  return Promise.all(
    (await articles(lang)).map(async (a): Promise<FeedItem> => {
      const page = absoluteUrl(articlePath(a.id, lang));
      return {
        title: a.title,
        url: page,
        description: a.description,
        content:
          translationNote(lang, a.original, articlePath(a.id, a.original)) + absoluteUrls(await body(a.entry), page),
        category: t.writing.topics[a.topic],
        date: a.pubDate,
      };
    }),
  );
}

export async function photoItems(lang: Lang): Promise<FeedItem[]> {
  const t = ui[lang];
  const body = await htmlRenderer();
  return Promise.all(
    (await allSeries(lang)).map(async (s): Promise<FeedItem> => {
      const page = absoluteUrl(seriesPath(s.id, lang));
      const cover = smallestAtLeast(s.cover.data.variants.webp, FEED_IMAGE_WIDTH);
      const image = absoluteUrl(variantPath(cover.file));
      const figure = `<p><img src="${image}" alt="${esc(s.cover.alt)}" width="${cover.width}" height="${cover.height}" /></p>\n`;
      return {
        title: s.title,
        url: page,
        description: s.description,
        content:
          translationNote(lang, s.original, seriesPath(s.id, s.original)) +
          figure +
          absoluteUrls(await body(s.entry), page),
        category: t.nav.photos,
        date: s.published,
        image: { url: image, type: 'image/webp', bytes: cover.bytes },
      };
    }),
  );
}

interface Channel {
  title: string;
  description: string;
  page: string;
  feed: string;
}

export const feedResponse = (lang: Lang, channel: Channel, items: FeedItem[]) =>
  new Response(
    rssFeed(
      {
        title: channel.title,
        url: absoluteUrl(localize(channel.page, lang)),
        self: absoluteUrl(localize(channel.feed, lang)),
        description: channel.description,
        language: lang,
        image: { url: absoluteUrl(paths.feedImage), size: FEED_ICON_SIZE },
      },
      items,
    ),
    { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' } },
  );

export const writingFeedTitle = (lang: Lang) => `${site.name} · ${ui[lang].nav.writing}`;
