import { prepare, type Prepared, type SearchEntry } from '../lib/search';

export function indexLoader(url: string) {
  let index: Promise<Prepared[]> | undefined;
  return {
    loaded: () => index !== undefined,
    load: () =>
      (index ??= fetch(url)
        .then((r) => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.json() as Promise<SearchEntry[]>;
        })
        .then(prepare)
        .catch((e) => {
          index = undefined;
          throw e;
        })),
  };
}
