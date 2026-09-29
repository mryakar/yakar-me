import { getCollection, type CollectionEntry } from 'astro:content';

export type Article = CollectionEntry<'writing'>;

// Raflar konuya göre (sitede seri kodu görünmez).
export const topics = ['Java', 'Databases'] as const;

/** En yeni önce. */
export async function articles(): Promise<Article[]> {
  return (await getCollection('writing')).sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());
}
