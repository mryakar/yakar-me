// Plak rafı: imleç ya da odak bir kılıfa gelince o rafın altındaki yazı değişir. Yalnızca hidden/aria-current.
for (const shelf of document.querySelectorAll<HTMLElement>('[data-shelf]')) {
  const sleeves = shelf.querySelectorAll<HTMLElement>('[data-article]');
  const panels = shelf.querySelectorAll<HTMLElement>('[data-panel]');
  const show = (id: string) => {
    for (const p of panels) p.hidden = p.dataset.panel !== id;
    for (const s of sleeves) s.toggleAttribute('aria-current', s.dataset.article === id);
  };
  for (const s of sleeves) {
    const id = s.dataset.article!;
    s.addEventListener('mouseenter', () => show(id));
    s.addEventListener('focus', () => show(id));
  }
}
