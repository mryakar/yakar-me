import type { Lang } from '../lib/i18n.ts';

export const pending: Record<Lang, readonly string[]> = {
  en: [],
  tr: [],
  es: [
    '/writing/database-transactions-and-springs-way-of-managing-them/',
    '/writing/explicit-locking-in-postgresql/',
    '/writing/how-to-write-equals-in-java/',
    '/writing/mvcc-how-postgresql-actually-implements-isolation/',
    '/writing/synchronized-or-reentrantlock-neither-prevents-deadlock/',
    '/writing/testing-private-methods/',
    '/writing/the-best-friend-of-equals-method-hashcode/',
    '/writing/the-program-that-refused-to-stop/',
  ],
};
