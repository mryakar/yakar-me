import { plural } from '../lib/format';
import { fragmentId } from '../lib/fragment';
import { filterQuery, matchesFilters, readFilters, toggleFilter } from '../lib/filter';
import { cardSlot, openFromHash } from './card-slot';

const root = document.querySelector<HTMLElement>('[data-playing]');
const filters = root?.querySelector<HTMLElement>('[data-filters]');
const crates = root?.querySelector<HTMLElement>('[data-crates]');

if (root && filters && crates) {
  const keys = ['category', 'genre'] as const;

  const songs = [...crates.querySelectorAll<HTMLDetailsElement>('[data-song]')];
  const sections = [...crates.querySelectorAll<HTMLElement>('[data-crate]')];
  const nowLinks = [...root.querySelectorAll<HTMLAnchorElement>('[data-now]')];
  const chips = [...filters.querySelectorAll<HTMLButtonElement>('button[data-filter]')];
  const genreGroup = filters.querySelector<HTMLElement>('[data-genres]')!;
  const result = filters.querySelector<HTMLElement>('[data-result]')!;
  const empty = filters.querySelector<HTMLElement>('[data-empty]')!;

  const known = new Map<string, Set<string>>(keys.map((k) => [k, new Set()]));
  for (const c of chips) known.get(c.dataset.filter!)?.add(c.dataset.value!);
  const parentOf = new Map(chips.filter((c) => c.dataset.filter === 'genre').map((c) => [c.dataset.value!, c.dataset.category!]));
  let state = readFilters(new URLSearchParams(location.search), known, parentOf);

  const place = cardSlot(songs, (open) => open.closest('[data-crate]')!.querySelector('[data-rail]')!, matchMedia('(width >= 48rem)'));
  const apply = () => {
    for (const c of chips) {
      const key = c.dataset.filter!;
      c.setAttribute('aria-pressed', String(state.get(key) === c.dataset.value));
      if (key === 'genre') c.hidden = c.dataset.category !== state.get('category');
    }
    genreGroup.hidden = !state.has('category');

    let shown = 0;
    for (const section of sections) {
      let inCrate = 0;
      for (const song of section.querySelectorAll<HTMLDetailsElement>('[data-song]')) {
        const match = matchesFilters(song.dataset, state);
        song.hidden = !match;
        if (!match) song.open = false;
        else inCrate++;
      }
      section.hidden = inCrate === 0;
      section.querySelector('[data-crate-count]')!.textContent = String(inCrate);
      shown += inCrate;
    }

    result.textContent = plural({ one: result.dataset.one!, other: result.dataset.other! }, shown);
    empty.hidden = shown > 0;

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

  for (const link of nowLinks) {
    link.addEventListener('click', (event) => {
      event.preventDefault();
      if (songs.find((song) => song.id === link.dataset.now)?.hidden) {
        state = new Map();
        apply();
      }
      history.replaceState(history.state, '', `${location.pathname}${location.search}#${link.dataset.now}`);
      openFromHash(songs, link.dataset.now!, place);
    });
  }

  crates.dataset.enhanced = '';
  filters.hidden = false;
  apply();
  openFromHash(songs, fragmentId(location.hash), place);
}
