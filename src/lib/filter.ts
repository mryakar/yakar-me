export type FilterState = Map<string, string>;

export function readFilters(params: URLSearchParams, known: Map<string, Set<string>>, parentOf: Map<string, string>) {
  const state: FilterState = new Map();
  for (const [key, values] of known) {
    const value = params.get(key);
    if (value && values.has(value)) state.set(key, value);
  }
  const genre = state.get('genre');
  if (genre) state.set('category', parentOf.get(genre)!);
  return state;
}

export function toggleFilter(state: FilterState, key: string, value: string) {
  const next = new Map(state);
  if (key === 'category') next.delete('genre');
  if (!value || state.get(key) === value) next.delete(key);
  else next.set(key, value);
  return next;
}

export const filterQuery = (keys: readonly string[], state: FilterState) =>
  new URLSearchParams(keys.flatMap((k) => (state.has(k) ? [[k, state.get(k)!]] : []))).toString();

export const matchesFilters = (data: Record<string, string | undefined>, state: FilterState) =>
  [...state].every(([key, value]) => data[key] === value);
