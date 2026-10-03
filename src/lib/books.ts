import { getCollection, type CollectionEntry } from 'astro:content';
import type { Lang } from './i18n';
import { monthStart } from './format';
import { newestFirst, type BookLanguage, type Category, type Genre } from './book';

export interface Book {
  id: string;
  title: string;
  originalTitle: string;
  author: string;
  originalLanguage: BookLanguage;
  readIn: BookLanguage;
  category: Category;
  genre: Genre;
  edition?: number;
  pages: number;
}

export interface ReadingBook extends Book {
  nowNote?: string;
}

export interface FinishedBook extends Book {
  finished: Date;
}

export async function books(lang: Lang) {
  const entries = (await getCollection('books')).map((e) => e.data);
  if (entries.length === 0) throw new Error('src/content/books.json has no books');
  const book = (b: CollectionEntry<'books'>['data']): Book => ({
    id: b.id,
    title: b.title[lang],
    originalTitle: b.originalTitle,
    author: b.author,
    originalLanguage: b.originalLanguage,
    readIn: b.readIn,
    category: b.category,
    genre: b.genre,
    edition: b.edition,
    pages: b.pages,
  });
  const finished = newestFirst(entries.flatMap((b) => (b.status === 'finished' ? [b] : [])));
  return {
    reading: entries
      .flatMap((b) => (b.status === 'reading' ? [b] : []))
      .toSorted((a, b) => a.position - b.position)
      .map((b): ReadingBook => ({ ...book(b), nowNote: b.nowNote?.[lang] })),
    finished: finished.map((b): FinishedBook => ({ ...book(b), finished: monthStart(b.finished) })),
  };
}
