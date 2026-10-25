import type { APIRoute, InferGetStaticPropsType } from 'astro';
import { site, paths } from '../../site';
import { ui } from '../../i18n/ui';
import { langPaths } from '../../lib/i18n';
import { feedResponse, photoItems, writingItems } from '../../lib/feeds';

export const getStaticPaths = langPaths;

export const GET: APIRoute<InferGetStaticPropsType<typeof getStaticPaths>> = async ({ props: { lang } }) =>
  feedResponse(lang, { title: site.name, description: ui[lang].description, page: paths.home, feed: paths.feed }, [
    ...(await writingItems(lang)),
    ...(await photoItems(lang)),
  ]);
