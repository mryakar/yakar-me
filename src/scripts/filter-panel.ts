import { plural } from '../lib/format';
import { filterQuery, readFilters, toggleFilter, type FilterState } from '../lib/filter';
import { replaceQuery } from './history';

export function filterPanel(filters: HTMLElement, keys: readonly string[], render: (state: FilterState) => number) {
  const chips = [...filters.querySelectorAll<HTMLButtonElement>('button[data-filter]')];
  const selects = [...filters.querySelectorAll<HTMLSelectElement>('select[data-filter]')];
  const genreGroup = filters.querySelector<HTMLElement>('[data-genres]')!;
  const result = filters.querySelector<HTMLElement>('[data-result]')!;
  const empty = filters.querySelector<HTMLElement>('[data-empty]')!;

  const known = new Map<string, Set<string>>(keys.map((k) => [k, new Set()]));
  for (const c of chips) if (c.dataset.value) known.get(c.dataset.filter!)?.add(c.dataset.value);
  for (const s of selects) for (const o of s.options) if (o.value) known.get(s.dataset.filter!)?.add(o.value);
  const parentOf = new Map(chips.filter((c) => c.dataset.filter === 'genre').map((c) => [c.dataset.value!, c.dataset.category!]));
  let state = readFilters(new URLSearchParams(location.search), known, parentOf);

  const apply = () => {
    for (const c of chips) {
      const key = c.dataset.filter!;
      c.setAttribute('aria-pressed', String((state.get(key) ?? '') === c.dataset.value));
      if (key === 'genre') c.hidden = c.dataset.category !== state.get('category');
    }
    genreGroup.hidden = !state.has('category');
    for (const s of selects) s.value = state.get(s.dataset.filter!) ?? '';

    const shown = render(state);
    result.textContent = plural({ one: result.dataset.one!, other: result.dataset.other! }, shown);
    empty.hidden = shown > 0;
    replaceQuery(filterQuery(keys, state));
  };
  const set = (next: FilterState) => {
    state = next;
    apply();
  };

  for (const c of chips) c.addEventListener('click', () => set(toggleFilter(state, c.dataset.filter!, c.dataset.value!)));
  for (const s of selects) {
    s.addEventListener('change', () => {
      const next = new Map(state);
      if (s.value) next.set(s.dataset.filter!, s.value);
      else next.delete(s.dataset.filter!);
      set(next);
    });
  }

  filters.hidden = false;
  return { apply, set };
}
