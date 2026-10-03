import { fragmentId } from '../lib/fragment';
import { cardSlot, openFromHash, rowEnd } from './card-slot';

const container = document.querySelector<HTMLElement>('[data-artists]');

if (container) {
  const artists = [...container.querySelectorAll<HTMLDetailsElement>('[data-artist]')];
  const place = cardSlot(artists, (open) => rowEnd(open, artists), matchMedia('(width >= 48rem)'));
  container.dataset.enhanced = '';
  openFromHash(artists, fragmentId(location.hash), place);
}
