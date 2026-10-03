import { plural } from '../lib/format';
import { fragmentId } from '../lib/fragment';
import { filterQuery, matchesFilters, readFilters, toggleFilter } from '../lib/filter';
import { cardSlot, openFromHash, rowEnd } from './card-slot';

const root = document.querySelector<HTMLElement>('[data-reading]');
const filters = root?.querySelector<HTMLElement>('[data-filters]');
const bookcase = root?.querySelector<HTMLElement>('[data-bookcase]');

if (root && filters && bookcase) {
  const keys = ['category', 'genre', 'original', 'read', 'year'] as const;

  const books = [...bookcase.querySelectorAll<HTMLDetailsElement>('[data-book]')];
  const years = [...bookcase.querySelectorAll<HTMLElement>('[data-shelf-year]')];
  const chips = [...filters.querySelectorAll<HTMLButtonElement>('button[data-filter]')];
  const selects = [...filters.querySelectorAll<HTMLSelectElement>('select[data-filter]')];
  const genreGroup = filters.querySelector<HTMLElement>('[data-genres]')!;
  const toggle = filters.querySelector<HTMLButtonElement>('[data-filter-toggle]')!;
  const toggleLabel = toggle.querySelector<HTMLElement>('[data-filter-label]')!;
  const result = filters.querySelector<HTMLElement>('[data-result]')!;
  const clear = filters.querySelector<HTMLButtonElement>('[data-clear]')!;
  const empty = filters.querySelector<HTMLElement>('[data-empty]')!;

  const known = new Map<string, Set<string>>(keys.map((k) => [k, new Set()]));
  for (const c of chips) if (c.dataset.value) known.get(c.dataset.filter!)?.add(c.dataset.value);
  for (const s of selects) for (const o of s.options) if (o.value) known.get(s.dataset.filter!)?.add(o.value);
  const parentOf = new Map(chips.filter((c) => c.dataset.filter === 'genre').map((c) => [c.dataset.value!, c.dataset.category!]));
  let state = readFilters(new URLSearchParams(location.search), known, parentOf);

  const shelfItems = [...bookcase.querySelectorAll<HTMLElement>('[data-shelf-item]')];
  const place = cardSlot(books, (open) => rowEnd(open, shelfItems), matchMedia('(width >= 48rem)'));

  const apply = () => {
    for (const c of chips) {
      const key = c.dataset.filter!;
      c.setAttribute('aria-pressed', String((state.get(key) ?? '') === c.dataset.value));
      if (key === 'genre') c.hidden = c.dataset.category !== state.get('category');
    }
    genreGroup.hidden = !state.has('category');
    for (const s of selects) s.value = state.get(s.dataset.filter!) ?? '';

    let shown = 0;
    for (const book of books) {
      const match = matchesFilters(book.dataset, state);
      book.hidden = !match;
      if (!match) book.open = false;
      else shown++;
    }
    for (const y of years) y.hidden = !y.querySelector('[data-book]:not([hidden])');

    result.textContent = plural({ one: result.dataset.one!, other: result.dataset.other! }, shown);
    empty.hidden = shown > 0;
    clear.hidden = state.size === 0;
    toggleLabel.textContent = state.size ? `${toggle.dataset.label} · ${state.size}` : toggle.dataset.label!;

    const query = filterQuery(keys, state);
    history.replaceState(history.state, '', `${location.pathname}${query ? `?${query}` : ''}${location.hash}`);
    place();
  };

  for (const c of chips) {
    c.addEventListener('click', () => {
      state = toggleFilter(state, c.dataset.filter!, c.dataset.value!);
      apply();
    });
  }
  for (const s of selects) {
    s.addEventListener('change', () => {
      state = new Map(state);
      if (s.value) state.set(s.dataset.filter!, s.value);
      else state.delete(s.dataset.filter!);
      apply();
    });
  }
  clear.addEventListener('click', () => {
    state = new Map();
    apply();
  });
  toggle.addEventListener('click', () => toggle.setAttribute('aria-expanded', String(toggle.getAttribute('aria-expanded') !== 'true')));

  bookcase.dataset.enhanced = '';
  filters.hidden = false;
  apply();
  openFromHash(books, fragmentId(location.hash), place);
}
