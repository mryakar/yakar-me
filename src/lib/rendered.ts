import { render, type CollectionEntry } from 'astro:content';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';

export type Renderable = CollectionEntry<'writing' | 'writingTranslations' | 'series' | 'seriesTranslations'>;

export async function htmlRenderer() {
  const container = await AstroContainer.create();
  return async (entry: Renderable) => container.renderToString((await render(entry)).Content);
}
