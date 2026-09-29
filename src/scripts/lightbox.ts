const dialog = document.querySelector<HTMLDialogElement>('[data-lightbox]');

if (dialog) {
  const panels = [...dialog.querySelectorAll<HTMLElement>('[data-photo]')];
  const ids = panels.map((p) => p.dataset.photo!);
  let current = -1;

  const show = (index: number) => {
    current = (index + panels.length) % panels.length;
    panels.forEach((p, i) => (p.hidden = i !== current));
    history.replaceState(null, '', `#${ids[current]}`);
  };

  const open = (id: string) => {
    const index = ids.indexOf(id);
    if (index < 0) return false;
    show(index);
    if (!dialog.open) dialog.showModal();
    return true;
  };

  for (const tile of document.querySelectorAll<HTMLAnchorElement>('[data-open]')) {
    tile.addEventListener('click', (e) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
      if (open(tile.dataset.open!)) e.preventDefault();
    });
  }

  dialog.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    if (target === dialog || target.closest('[data-close]')) dialog.close();
    else if (target.closest('[data-prev]')) show(current - 1);
    else if (target.closest('[data-next]')) show(current + 1);
  });

  dialog.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') show(current - 1);
    else if (e.key === 'ArrowRight') show(current + 1);
    else return;
    e.preventDefault();
  });

  dialog.addEventListener('close', () => {
    history.replaceState(null, '', location.pathname + location.search);
    document.querySelector<HTMLElement>(`[data-open="${ids[current]}"]`)?.focus();
  });

  if (location.hash) open(decodeURIComponent(location.hash.slice(1)));
}
