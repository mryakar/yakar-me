import { fragmentId } from '../lib/fragment';
import { cardSlot, openFromHash } from './card-slot';
import { filterPanel, showMatching } from './filter-panel';

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
      const inCrate = showMatching(section.querySelectorAll<HTMLDetailsElement>('[data-song]'), state);
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
