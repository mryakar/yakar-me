addEventListener('pageswap', (e) => {
  if (!e.viewTransition || !e.activation?.entry.url) return;
  const to = new URL(e.activation.entry.url).pathname;
  for (const link of document.querySelectorAll<HTMLElement>('[data-cover-pair]')) {
    const img = link.querySelector('img');
    if (img) img.style.viewTransitionName = link.dataset.coverPair!.split(' ').includes(to) ? '' : 'none';
  }
});

const warmed = new WeakSet<HTMLElement>();

function warm(link: HTMLElement) {
  const source = link.querySelector('source');
  if (warmed.has(link) || !source) return;
  warmed.add(link);
  const img = new Image();
  img.sizes = link.dataset.coverSizes!;
  img.srcset = source.srcset;
}

for (const link of document.querySelectorAll<HTMLElement>('[data-cover-sizes]')) {
  for (const type of ['pointerenter', 'focus', 'pointerdown']) link.addEventListener(type, () => warm(link));
}
