export function rowEnd(item: HTMLElement, row: HTMLElement[]) {
  const bottom = (el: HTMLElement) => el.offsetTop + el.offsetHeight;
  const line = bottom(item);
  return row.filter((el) => el.offsetParent && Math.abs(bottom(el) - line) < 2).at(-1)!;
}

export function closable(item: HTMLDetailsElement, card = item.querySelector<HTMLElement>('[data-card]')!) {
  const close = card.querySelector<HTMLButtonElement>('[data-close]')!;
  close.hidden = false;
  close.addEventListener('click', () => {
    item.open = false;
    item.querySelector('summary')!.focus();
  });
}

export function cardSlot(items: HTMLDetailsElement[], anchor: (open: HTMLDetailsElement) => Element, wide: MediaQueryList) {
  const cards = new Map(items.map((item) => [item, item.querySelector<HTMLElement>('[data-card]')!]));
  const slot = document.createElement('div');
  slot.className = 'card-slot';

  const place = () => {
    slot.remove();
    for (const [item, card] of cards) if (card.parentElement !== item) item.append(card);
    const open = items.find((item) => item.open && !item.hidden);
    if (!open || !wide.matches) return;
    slot.append(cards.get(open)!);
    anchor(open).after(slot);
  };

  for (const [item, card] of cards) {
    item.addEventListener('toggle', place);
    closable(item, card);
  }
  let frame = 0;
  addEventListener('resize', () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(place);
  });
  wide.addEventListener('change', place);
  return place;
}

export function openFromHash(items: HTMLDetailsElement[], id: string, place: () => void) {
  const linked = items.find((item) => item.id === id && !item.hidden);
  if (!linked) return;
  linked.open = true;
  place();
  linked.scrollIntoView({ block: 'start' });
}
