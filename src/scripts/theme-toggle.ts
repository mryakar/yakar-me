// Tema düğmesi: koyu ↔ açık. Seçim localStorage'da saklanır; erişilemezse yalnızca bu sayfada geçerli.
const root = document.documentElement;

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
    root.dataset.theme = next;
    try {
      localStorage.setItem('theme', next);
    } catch {}
    for (const b of document.querySelectorAll<HTMLElement>('[data-theme-toggle]')) label(b);
  });
}
