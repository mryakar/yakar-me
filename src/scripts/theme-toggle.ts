const root = document.documentElement;

function current(): 'light' | 'dark' {
  return root.dataset.theme === 'light' ? 'light' : 'dark';
}

function label(button: HTMLElement) {
  const next = current() === 'dark' ? 'light' : 'dark';
  button.setAttribute('aria-label', `Switch to ${next} theme`);
}

function apply(theme: 'light' | 'dark') {
  root.dataset.theme = theme;
  try {
    localStorage.setItem('theme', theme);
  } catch {}
  for (const b of document.querySelectorAll<HTMLElement>('[data-theme-toggle]')) label(b);
}

for (const button of document.querySelectorAll<HTMLButtonElement>('[data-theme-toggle]')) {
  label(button);
  button.addEventListener('click', () => {
    const next = current() === 'dark' ? 'light' : 'dark';
    if (document.startViewTransition && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      document.startViewTransition(() => apply(next)).ready.catch(() => {});
    } else {
      apply(next);
    }
  });
}
