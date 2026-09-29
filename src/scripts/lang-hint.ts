const KEY = 'lang-hint';
const hint = document.querySelector<HTMLElement>('[data-lang-hint]');
const target = hint?.dataset.langHint;

if (hint && target) {
  let dismissed = false;
  try {
    dismissed = localStorage.getItem(KEY) === 'dismissed';
  } catch {}
  const first = navigator.languages?.[0] ?? navigator.language ?? '';
  if (!dismissed && first.toLowerCase().split('-')[0] === target) hint.hidden = false;

  hint.querySelector('[data-lang-hint-close]')?.addEventListener('click', () => {
    hint.hidden = true;
    try {
      localStorage.setItem(KEY, 'dismissed');
    } catch {}
  });
}
