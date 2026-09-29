const KEY = 'lang-hint';
const hint = document.querySelector<HTMLElement>('[data-lang-hint]');

if (hint) {
  let dismissed = false;
  try {
    dismissed = localStorage.getItem(KEY) === 'dismissed';
  } catch {}
  const first = navigator.languages?.[0] ?? navigator.language ?? '';
  if (!dismissed && /^tr(-|$)/i.test(first)) hint.hidden = false;

  hint.querySelector('[data-lang-hint-close]')?.addEventListener('click', () => {
    hint.hidden = true;
    try {
      localStorage.setItem(KEY, 'dismissed');
    } catch {}
  });
}
