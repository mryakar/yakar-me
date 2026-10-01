import { plural } from '../lib/format';

const root = document.querySelector<HTMLElement>('[data-reading]');
const filters = root?.querySelector<HTMLElement>('[data-filters]');
const bookcase = root?.querySelector<HTMLElement>('[data-bookcase]');

if (root && filters && bookcase) {
  const keys = ['category', 'genre', 'original', 'read', 'year'] as const;
  type Key = (typeof keys)[number];
  const isKey = (k: string | undefined): k is Key => keys.includes(k as Key);

  const books = [...bookcase.querySelectorAll<HTMLDetailsElement>('[data-book]')];
  const years = [...bookcase.querySelectorAll<HTMLElement>('[data-shelf-year]')];
  const cards = new Map(books.map((b) => [b, b.querySelector<HTMLElement>('[data-card]')!]));
  const chips = [...filters.querySelectorAll<HTMLButtonElement>('button[data-filter]')];
  const selects = [...filters.querySelectorAll<HTMLSelectElement>('select[data-filter]')];
  const genreGroup = filters.querySelector<HTMLElement>('[data-genres]')!;
  const toggle = filters.querySelector<HTMLButtonElement>('[data-filter-toggle]')!;
  const toggleLabel = toggle.querySelector<HTMLElement>('[data-filter-label]')!;
  const result = filters.querySelector<HTMLElement>('[data-result]')!;
  const clear = filters.querySelector<HTMLButtonElement>('[data-clear]')!;
  const empty = filters.querySelector<HTMLElement>('[data-empty]')!;

  const known = new Map<Key, Set<string>>(keys.map((k) => [k, new Set()]));
  for (const c of chips) if (isKey(c.dataset.filter) && c.dataset.value) known.get(c.dataset.filter)!.add(c.dataset.value);
  for (const s of selects) if (isKey(s.dataset.filter)) for (const o of s.options) if (o.value) known.get(s.dataset.filter)!.add(o.value);
  const categoryOfGenre = new Map(chips.filter((c) => c.dataset.filter === 'genre').map((c) => [c.dataset.value!, c.dataset.category!]));

  const state = new Map<Key, string>();
  const params = new URLSearchParams(location.search);
  for (const k of keys) {
    const v = params.get(k);
    if (v && known.get(k)!.has(v)) state.set(k, v);
  }
  const genre = state.get('genre');
  if (genre) state.set('category', categoryOfGenre.get(genre)!);

  const wide = matchMedia('(width >= 48rem)');
  const slot = document.createElement('div');
  slot.className = 'book-slot';
  const bottom = (el: HTMLElement) => el.offsetTop + el.offsetHeight;
  const rowEnd = (book: HTMLElement) => {
    const line = bottom(book);
    const items = [...bookcase.querySelectorAll<HTMLElement>('[data-shelf-item]')];
    return items.filter((el) => el.offsetParent && Math.abs(bottom(el) - line) < 2).at(-1)!;
  };
  const place = () => {
    slot.remove();
    for (const [book, card] of cards) if (card.parentElement !== book) book.append(card);
    const open = books.find((b) => b.open && !b.hidden);
    if (!open || !wide.matches) return;
    slot.append(cards.get(open)!);
    rowEnd(open).after(slot);
  };

  const apply = () => {
    for (const c of chips) {
      const key = c.dataset.filter as Key;
      c.setAttribute('aria-pressed', String((state.get(key) ?? '') === c.dataset.value));
      if (key === 'genre') c.hidden = c.dataset.category !== state.get('category');
    }
    genreGroup.hidden = !state.has('category');
    for (const s of selects) s.value = state.get(s.dataset.filter as Key) ?? '';

    let shown = 0;
    for (const book of books) {
      const match = [...state].every(([k, v]) => book.dataset[k] === v);
      book.hidden = !match;
      if (!match) book.open = false;
      else shown++;
    }
    for (const y of years) y.hidden = !y.querySelector('[data-book]:not([hidden])');

    result.textContent = plural({ one: result.dataset.one!, other: result.dataset.other! }, shown);
    empty.hidden = shown > 0;
    clear.hidden = state.size === 0;
    toggleLabel.textContent = state.size ? `${toggle.dataset.label} · ${state.size}` : toggle.dataset.label!;

    const query = new URLSearchParams(keys.flatMap((k) => (state.has(k) ? [[k, state.get(k)!]] : []))).toString();
    history.replaceState(history.state, '', `${location.pathname}${query ? `?${query}` : ''}${location.hash}`);
    place();
  };

  for (const c of chips) {
    c.addEventListener('click', () => {
      const key = c.dataset.filter as Key;
      const value = c.dataset.value!;
      const off = !value || state.get(key) === value;
      if (key === 'category') state.delete('genre');
      if (off) state.delete(key);
      else state.set(key, value);
      apply();
    });
  }
  for (const s of selects) {
    s.addEventListener('change', () => {
      if (s.value) state.set(s.dataset.filter as Key, s.value);
      else state.delete(s.dataset.filter as Key);
      apply();
    });
  }
  clear.addEventListener('click', () => {
    state.clear();
    apply();
  });
  toggle.addEventListener('click', () => toggle.setAttribute('aria-expanded', String(toggle.getAttribute('aria-expanded') !== 'true')));

  for (const [book, card] of cards) {
    book.addEventListener('toggle', place);
    const close = card.querySelector<HTMLButtonElement>('[data-close]')!;
    close.hidden = false;
    close.addEventListener('click', () => {
      book.open = false;
      book.querySelector('summary')!.focus();
    });
  }
  let frame = 0;
  addEventListener('resize', () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(place);
  });
  wide.addEventListener('change', place);

  bookcase.dataset.enhanced = '';
  filters.hidden = false;
  apply();

  const linked = books.find((b) => `#${b.id}` === location.hash && !b.hidden);
  if (linked) {
    linked.open = true;
    place();
    linked.scrollIntoView({ block: 'start' });
  }
}
