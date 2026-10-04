import type { APIRoute } from 'astro';
import { render, type CollectionEntry } from 'astro:content';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { site } from '../../site';
import { bilingual, ui } from '../../i18n/ui';
import { langPaths, localize, type Lang } from '../../lib/i18n';
import { articles } from '../../lib/writing';
import { allSeries, smallestAtLeast } from '../../lib/photos';
import { seriesPath, variantPath } from '../../lib/photo';
import { absoluteUrls, rssFeed, type FeedItem } from '../../lib/feed';
import { articlePath, escapeXml as esc } from '../../lib/format';

export const getStaticPaths = langPaths;

const FEED_IMAGE_WIDTH = 1280;

export const GET: APIRoute = async ({ props, site: origin }) => {
  const { lang } = props as { lang: Lang };
  const t = ui[lang];
  const url = (path: string) => new URL(path, origin).toString();
  const container = await AstroContainer.create();
  const body = async (entry: CollectionEntry<'writing' | 'writingTranslations' | 'series' | 'seriesTranslations'>) =>
    container.renderToString((await render(entry)).Content);
  const translationNote = (original: Lang, path: string) =>
    original === lang ? '' : `<p><a href="${url(path)}">${esc(bilingual.translated.title(original))}</a></p>\n`;

  const writing = (await articles(lang)).map(async (a): Promise<FeedItem> => {
    const page = url(articlePath(a.id, lang));
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
    const page = url(seriesPath(s.id, lang));
    const cover = smallestAtLeast(s.cover.data.variants.webp, FEED_IMAGE_WIDTH);
    const image = url(variantPath(cover.file));
    const figure = `<p><img src="${image}" alt="${esc(s.cover.alt)}" width="${cover.width}" height="${cover.height}" /></p>\n`;
    return {
      title: s.title,
      url: page,
      description: s.description,
      content: translationNote(s.original, seriesPath(s.id, s.original)) + figure + absoluteUrls(await body(s.entry), page),
      category: t.nav.photos,
      date: s.published,
      image: { url: image, type: 'image/webp', bytes: cover.bytes },
    };
  });

  const xml = rssFeed(
    {
      title: site.name,
      url: url(localize('/', lang)),
      self: url(localize('/rss.xml', lang)),
      description: t.description,
      language: lang,
    },
    await Promise.all([...writing, ...photos]),
  );
  return new Response(xml, { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' } });
};
