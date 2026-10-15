const KEY = 'lang-hint';
const first = (navigator.languages?.[0] ?? navigator.language ?? '').toLowerCase().split('-')[0];
const hint = [...document.querySelectorAll<HTMLElement>('[data-lang-hint]')].find((h) => h.dataset.langHint === first);

if (hint) {
  let dismissed = false;
  try {
    dismissed = localStorage.getItem(KEY) === 'dismissed';
  } catch {}
  if (!dismissed) hint.hidden = false;

  hint.querySelector('[data-lang-hint-close]')?.addEventListener('click', () => {
    hint.hidden = true;
    try {
      localStorage.setItem(KEY, 'dismissed');
    } catch {}
  });
}
