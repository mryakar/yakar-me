import { fragmentId } from '../lib/fragment';
import { cardSlot, openFromHash, rowEnd } from './card-slot';
import { filterPanel, showMatching } from './filter-panel';

const root = document.querySelector<HTMLElement>('[data-reading]');
const filters = root?.querySelector<HTMLElement>('[data-filters]');
const bookcase = root?.querySelector<HTMLElement>('[data-bookcase]');

if (root && filters && bookcase) {
  const books = [...bookcase.querySelectorAll<HTMLDetailsElement>('[data-book]')];
  const years = [...bookcase.querySelectorAll<HTMLElement>('[data-shelf-year]')];
  const shelfItems = [...bookcase.querySelectorAll<HTMLElement>('[data-shelf-item]')];
  const toggle = filters.querySelector<HTMLButtonElement>('[data-filter-toggle]')!;
  const toggleLabel = toggle.querySelector<HTMLElement>('[data-filter-label]')!;
  const clear = filters.querySelector<HTMLButtonElement>('[data-clear]')!;
  const place = cardSlot(books, (open) => rowEnd(open, shelfItems));

  const panel = filterPanel(filters, ['category', 'genre', 'original', 'read', 'year'], (state) => {
    const shown = showMatching(books, state);
    for (const y of years) y.hidden = !y.querySelector('[data-book]:not([hidden])');
    clear.hidden = state.size === 0;
    toggleLabel.textContent = state.size ? `${toggle.dataset.label} · ${state.size}` : toggle.dataset.label!;
    place();
    return shown;
  });

  clear.addEventListener('click', () => panel.set(new Map()));
  toggle.addEventListener('click', () =>
    toggle.setAttribute('aria-expanded', String(toggle.getAttribute('aria-expanded') !== 'true')),
  );

  bookcase.dataset.enhanced = '';
  panel.apply();
  openFromHash(books, fragmentId(location.hash), place);
}
