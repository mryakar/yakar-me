import { SLIDE_MS, swipeAxis, swipeStep, type Axis, type Step } from '../lib/swipe';

const dialog = document.querySelector<HTMLDialogElement>('[data-lightbox]');

interface Drag {
  pointer: number;
  x: number;
  y: number;
  time: number;
  dx: number;
  axis: Axis | null;
}

if (dialog) {
  const panels = [...dialog.querySelectorAll<HTMLElement>('[data-photo]')];
  const ids = panels.map((p) => p.dataset.photo!);
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let current = -1;
  let drag: Drag | null = null;
  let sliding = false;

  const wrap = (index: number) => (index + panels.length) % panels.length;
  const stage = (index: number) => panels[index].querySelector<HTMLElement>('.lightbox-stage')!;
  const picture = (index: number) => stage(index).querySelector<HTMLElement>('picture')!;

  const show = (index: number) => {
    current = wrap(index);
    panels.forEach((p, i) => (p.hidden = i !== current));
    for (const neighbour of [current - 1, current + 1]) picture(wrap(neighbour)).querySelector('img')!.loading = 'eager';
    history.replaceState(null, '', `#${ids[current]}`);
  };

  const open = (id: string) => {
    const index = ids.indexOf(id);
    if (index < 0) return false;
    show(index);
    if (!dialog.open) dialog.showModal();
    return true;
  };

  const shift = (element: HTMLElement, from: number, to: number, easing: string) => {
    element.style.transform = to ? `translateX(${to}px)` : '';
    if (reducedMotion.matches || from === to) return Promise.resolve();
    const frames = [{ transform: `translateX(${from}px)` }, { transform: `translateX(${to}px)` }];
    return element.animate(frames, { duration: SLIDE_MS / 2, easing }).finished.then(() => undefined);
  };

  const slide = async (step: Step, from: number) => {
    const leaving = picture(current);
    if (step === 0) return shift(leaving, from, 0, 'ease-out');
    const width = stage(current).clientWidth;
    const next = current + step;
    await shift(leaving, from, -step * width, 'ease-in');
    show(next);
    leaving.style.transform = '';
    await shift(picture(current), step * width, 0, 'ease-out');
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

  dialog.addEventListener('pointerdown', (e) => {
    if (drag) {
      picture(current).style.transform = '';
      drag = null;
      return;
    }
    if (e.pointerType === 'mouse' || sliding || (visualViewport && visualViewport.scale > 1)) return;
    if (!(e.target as HTMLElement).closest('.lightbox-stage')) return;
    drag = { pointer: e.pointerId, x: e.clientX, y: e.clientY, time: e.timeStamp, dx: 0, axis: null };
  });

  dialog.addEventListener('pointermove', (e) => {
    if (e.pointerId !== drag?.pointer) return;
    const dx = e.clientX - drag.x;
    drag.axis ??= swipeAxis(dx, e.clientY - drag.y);
    if (drag.axis !== 'x') return;
    drag.dx = dx;
    picture(current).style.transform = `translateX(${dx}px)`;
  });

  const release = (e: PointerEvent) => {
    if (e.pointerId !== drag?.pointer) return;
    const { axis, dx, time } = drag;
    drag = null;
    if (axis !== 'x') return;
    const step = e.type === 'pointerup' ? swipeStep(dx, e.timeStamp - time, stage(current).clientWidth) : 0;
    sliding = true;
    slide(step, dx).finally(() => (sliding = false));
  };
  dialog.addEventListener('pointerup', release);
  dialog.addEventListener('pointercancel', release);

  dialog.addEventListener('close', () => {
    history.replaceState(null, '', location.pathname + location.search);
    document.querySelector<HTMLElement>(`[data-open="${ids[current]}"]`)?.focus();
  });

  if (location.hash) open(decodeURIComponent(location.hash.slice(1)));
}
