import type { APIRoute, InferGetStaticPropsType } from 'astro';
import { site, paths } from '../../site';
import { bilingual, ui } from '../../i18n/ui';
import { langPaths, localize, type Lang } from '../../lib/i18n';
import { articles } from '../../lib/writing';
import { allSeries } from '../../lib/photos';
import { seriesPath, smallestAtLeast, variantPath } from '../../lib/photo';
import { absoluteUrls, rssFeed, type FeedItem } from '../../lib/feed';
import { absoluteUrl, articlePath, escapeXml as esc } from '../../lib/format';
import { htmlRenderer } from '../../lib/rendered';

export const getStaticPaths = langPaths;

const FEED_IMAGE_WIDTH = 1280;
const FEED_ICON_SIZE = 144;

export const GET: APIRoute<InferGetStaticPropsType<typeof getStaticPaths>> = async ({ props }) => {
  const { lang } = props;
  const t = ui[lang];
  const body = await htmlRenderer();
  const translationNote = (original: Lang, path: string) =>
    original === lang ? '' : `<p><a href="${absoluteUrl(path)}">${esc(bilingual.translated.title(original))}</a></p>\n`;

  const writing = (await articles(lang)).map(async (a): Promise<FeedItem> => {
    const page = absoluteUrl(articlePath(a.id, lang));
    return {
      title: a.title,
      url: page,
      description: a.description,
      content: translationNote(a.original, articlePath(a.id, a.original)) + absoluteUrls(await body(a.entry), page),
      category: t.writing.topics[a.topic],
      date: a.pubDate,
    };
  });

  const photos = (await allSeries(lang)).map(async (s): Promise<FeedItem> => {
    const page = absoluteUrl(seriesPath(s.id, lang));
    const cover = smallestAtLeast(s.cover.data.variants.webp, FEED_IMAGE_WIDTH);
    const image = absoluteUrl(variantPath(cover.file));
    const figure = `<p><img src="${image}" alt="${esc(s.cover.alt)}" width="${cover.width}" height="${cover.height}" /></p>\n`;
    return {
      title: s.title,
      url: page,
      description: s.description,
      content:
        translationNote(s.original, seriesPath(s.id, s.original)) + figure + absoluteUrls(await body(s.entry), page),
      category: t.nav.photos,
      date: s.published,
      image: { url: image, type: 'image/webp', bytes: cover.bytes },
    };
  });

  const xml = rssFeed(
    {
      title: site.name,
      url: absoluteUrl(localize(paths.home, lang)),
      self: absoluteUrl(localize(paths.feed, lang)),
      description: t.description,
      language: lang,
      image: { url: absoluteUrl(paths.feedImage), size: FEED_ICON_SIZE },
    },
    await Promise.all([...writing, ...photos]),
  );
  return new Response(xml, { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' } });
};
