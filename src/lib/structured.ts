import { isoDate } from './format.ts';
import type { Lang } from './i18n.ts';

export const jsonLd = (data: unknown) =>
  JSON.stringify(data).replace(/[<>&\u2028\u2029]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`);

export interface Author {
  name: string;
  url: string;
}

export const person = (author: Author, sameAs: string[] = []) => ({
  '@type': 'Person',
  name: author.name,
  url: author.url,
  ...(sameAs.length ? { sameAs } : {}),
});

export function blogPosting(o: {
  headline: string;
  description: string;
  published: Date;
  lang: Lang;
  url: string;
  image: string;
  author: Author;
  original?: { url: string; lang: Lang };
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: o.headline,
    description: o.description,
    datePublished: isoDate(o.published),
    inLanguage: o.lang,
    url: o.url,
    image: o.image,
    author: person(o.author),
    ...(o.original
      ? { translationOfWork: { '@type': 'BlogPosting', url: o.original.url, inLanguage: o.original.lang } }
      : {}),
  };
}

export const profile = (author: Author, sameAs: string[]) => ({ '@context': 'https://schema.org', ...person(author, sameAs) });
