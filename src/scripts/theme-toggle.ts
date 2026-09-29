const root = document.documentElement;
let timer = 0;

function current(): 'light' | 'dark' {
  return root.dataset.theme === 'light' ? 'light' : 'dark';
}

function label(button: HTMLElement) {
  const next = current() === 'dark' ? 'light' : 'dark';
  button.setAttribute('aria-label', `Switch to ${next} theme`);
}

for (const button of document.querySelectorAll<HTMLButtonElement>('[data-theme-toggle]')) {
  label(button);
  button.addEventListener('click', () => {
    const next = current() === 'dark' ? 'light' : 'dark';
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
      root.classList.add('theme-switching');
      window.clearTimeout(timer);
      timer = window.setTimeout(() => root.classList.remove('theme-switching'), 450);
    }
    root.dataset.theme = next;
    try {
      localStorage.setItem('theme', next);
    } catch {}
    for (const b of document.querySelectorAll<HTMLElement>('[data-theme-toggle]')) label(b);
  });
}
