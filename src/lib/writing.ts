import { getCollection, type CollectionEntry } from 'astro:content';
import { pending } from '../i18n/pending';
import { other, type Lang } from './i18n';
import { translationStatus } from './translations';

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
  const keys = originals.map((o) => ({ id: o.id, lang: o.data.lang }));
  const ids = translations.map((t) => t.id);
  const here = translationStatus('writing', keys, ids, lang, pending);
  const there = translationStatus('writing', keys, ids, other(lang), pending);
  return originals
    .filter((o) => here.get(o.id) !== 'pending')
    .map((o) => {
      const t = here.get(o.id) === 'translated' ? translations.find((t) => t.id === `${o.id}/${lang}`)! : undefined;
      const text = t?.data ?? o.data;
      return {
        id: o.id,
        lang,
        original: o.data.lang,
        alternate: there.get(o.id) !== 'pending',
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
