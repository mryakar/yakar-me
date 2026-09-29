import { getCollection, type CollectionEntry } from 'astro:content';

export type Article = CollectionEntry<'writing'>;

export const topics = ['Java', 'Databases'] as const;

export async function articles(): Promise<Article[]> {
  return (await getCollection('writing')).sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());
}
