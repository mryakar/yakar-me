import { matchesFilters } from '../lib/filter';
import { fragmentId } from '../lib/fragment';
import { cardSlot, openFromHash } from './card-slot';
import { filterPanel } from './filter-panel';

const root = document.querySelector<HTMLElement>('[data-playing]');
const filters = root?.querySelector<HTMLElement>('[data-filters]');
const crates = root?.querySelector<HTMLElement>('[data-crates]');

if (root && filters && crates) {
  const songs = [...crates.querySelectorAll<HTMLDetailsElement>('[data-song]')];
  const sections = [...crates.querySelectorAll<HTMLElement>('[data-crate]')];
  const nowLinks = [...root.querySelectorAll<HTMLAnchorElement>('[data-now]')];
  const place = cardSlot(songs, (open) => open.closest('[data-crate]')!.querySelector('[data-rail]')!);

  const panel = filterPanel(filters, ['category', 'genre'], (state) => {
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
    place();
    return shown;
  });

  for (const link of nowLinks) {
    link.addEventListener('click', (event) => {
      event.preventDefault();
      if (songs.find((song) => song.id === link.dataset.now)?.hidden) panel.set(new Map());
      history.replaceState(history.state, '', `${location.pathname}${location.search}#${link.dataset.now}`);
      openFromHash(songs, link.dataset.now!, place);
    });
  }

  crates.dataset.enhanced = '';
  panel.apply();
  openFromHash(songs, fragmentId(location.hash), place);
}
