for (const group of document.querySelectorAll<HTMLElement>('[data-previews]')) {
  const triggers = group.querySelectorAll<HTMLElement>('[data-preview-for]');
  const previews = group.querySelectorAll<HTMLElement>('[data-preview]');
  const show = (id: string) => {
    for (const p of previews) p.hidden = p.dataset.preview !== id;
    for (const t of triggers) t.toggleAttribute('data-active', t.dataset.previewFor === id);
  };
  for (const t of triggers) {
    const id = t.dataset.previewFor!;
    t.addEventListener('mouseenter', () => show(id));
    t.addEventListener('focus', () => show(id));
  }
}
