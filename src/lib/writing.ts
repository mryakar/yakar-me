import { getCollection, type CollectionEntry } from 'astro:content';
import { pending } from '../i18n/pending';
import type { Lang } from './i18n';
import { localized } from './translations';

export const topics = ['Java', 'Databases'] as const;

export interface Article {
  id: string;
  lang: Lang;
  original: Lang;
  alternate: boolean;
  title: string;
  description: string;
  short?: string;
  mediumUrl: string;
  pubDate: Date;
  topic: (typeof topics)[number];
  entry: CollectionEntry<'writing'> | CollectionEntry<'writingTranslations'>;
}

export async function articles(lang: Lang): Promise<Article[]> {
  const [originals, translations] = await Promise.all([getCollection('writing'), getCollection('writingTranslations')]);
  return localized('writing', originals, (o) => o.data.lang, translations, lang, pending)
    .map(({ original: o, translation: t, alternate }) => {
      const text = t?.data ?? o.data;
      return {
        id: o.id,
        lang,
        original: o.data.lang,
        alternate,
        title: text.title,
        description: text.description,
        short: text.short,
        mediumUrl: text.mediumUrl,
        pubDate: o.data.pubDate,
        topic: o.data.topic,
        entry: t ?? o,
      };
    })
    .sort((a, b) => b.pubDate.valueOf() - a.pubDate.valueOf());
}
