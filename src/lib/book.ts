export const genres = {
  literature: ['novel', 'novella', 'thriller', 'allegory'],
  philosophy: ['ancient-philosophy', 'strategy', 'spirituality'],
  science: ['history', 'biology', 'psychology', 'science-religion'],
  'personal-development': ['narrative', 'applied-psychology'],
  technical: ['system-design', 'software-process', 'free-software'],
} as const;

export type Category = keyof typeof genres;
export type Genre = (typeof genres)[Category][number];

export const categories = Object.keys(genres) as Category[];
export const allGenres = categories.flatMap((c) => genres[c]) as Genre[];
export const categoryOf = (genre: Genre) => categories.find((c) => (genres[c] as readonly Genre[]).includes(genre))!;

export const categoryTint: Record<Category, string> = {
  literature: 'bg-cat-literature',
  philosophy: 'bg-cat-philosophy',
  science: 'bg-cat-science',
  'personal-development': 'bg-cat-personal-development',
  technical: 'bg-cat-technical',
};

export const bookLanguages = ['en', 'fr', 'de', 'grc', 'pt', 'ru', 'tr', 'lzh', 'he', 'it'] as const;
export type BookLanguage = (typeof bookLanguages)[number];

export function isIsbn13(isbn: string) {
  if (!/^97[89]\d{10}$/.test(isbn)) return false;
  const sum = [...isbn].reduce((s, d, i) => s + Number(d) * (i % 2 ? 3 : 1), 0);
  return sum % 10 === 0;
}

export const finishedDate = (month: string) => new Date(`${month}-01T00:00:00Z`);

export const newestFirst = <T extends { finished: string; position: number }>(books: T[]) =>
  books.toSorted((a, b) => b.finished.localeCompare(a.finished) || a.position - b.position);

export function byYear<T extends { finished: Date }>(books: T[]) {
  const years: { year: number; books: T[] }[] = [];
  for (const book of books) {
    const year = book.finished.getUTCFullYear();
    const last = years.at(-1);
    if (last?.year === year) last.books.push(book);
    else years.push({ year, books: [book] });
  }
  return years;
}

export const SPINE_THICKNESSES = 16;
export const SPINE_HEIGHTS = 5;

export const spineThickness = (pages: number) => Math.min(SPINE_THICKNESSES - 1, Math.max(0, Math.round((pages - 40) / 50)));

export function spineHeight(isbn: string) {
  let hash = 0;
  for (const ch of isbn) hash = (hash * 31 + ch.charCodeAt(0)) % 997;
  return hash % SPINE_HEIGHTS;
}
