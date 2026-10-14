addEventListener('pageswap', (e) => {
  if (!e.viewTransition || !e.activation?.entry.url) return;
  const to = new URL(e.activation.entry.url).pathname;
  for (const link of document.querySelectorAll<HTMLElement>('[data-cover-pair]')) {
    const img = link.querySelector('img');
    if (img) img.style.viewTransitionName = link.dataset.coverPair!.split(' ').includes(to) ? '' : 'none';
  }
});
