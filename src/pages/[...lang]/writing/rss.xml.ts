import type { APIRoute, InferGetStaticPropsType } from 'astro';
import { paths } from '../../../site';
import { ui } from '../../../i18n/ui';
import { langPaths } from '../../../lib/i18n';
import { feedResponse, writingFeedTitle, writingItems } from '../../../lib/feeds';

export const getStaticPaths = langPaths;

export const GET: APIRoute<InferGetStaticPropsType<typeof getStaticPaths>> = async ({ props: { lang } }) =>
  feedResponse(
    lang,
    {
      title: writingFeedTitle(lang),
      description: ui[lang].writing.description,
      page: paths.writing,
      feed: paths.writingFeed,
    },
    await writingItems(lang),
  );
