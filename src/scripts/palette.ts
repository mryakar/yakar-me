import type { SearchResult } from '../lib/search';

const dialog = document.querySelector<HTMLDialogElement>('[data-palette]');

if (dialog) {
  const text = dialog.dataset as Record<'index' | 'page' | 'one' | 'other' | 'none' | 'loading' | 'failed', string>;
  const input = dialog.querySelector<HTMLInputElement>('input')!;
  const listbox = dialog.querySelector<HTMLElement>('[role="listbox"]')!;
  const none = dialog.querySelector<HTMLElement>('[data-palette-none]')!;
  const status = dialog.querySelector<HTMLElement>('[data-palette-status]')!;
  const all = dialog.querySelector<HTMLAnchorElement>('[data-palette-all]')!;
  const template = dialog.querySelector<HTMLTemplateElement>('[data-palette-option]')!;
  const groups = [...dialog.querySelectorAll<HTMLElement>('[data-palette-group]')].map((group) => ({
    group,
    kind: group.dataset.paletteGroup!,
    count: group.querySelector<HTMLElement>('[data-palette-count]')!,
    list: group.querySelector<HTMLElement>('[data-palette-list]')!,
  }));
  let engine: ReturnType<typeof load> | undefined;
  const load = async () => {
    const [{ search }, { plural }, { indexLoader }] = await Promise.all([import('../lib/search'), import('../lib/format'), import('./search-index')]);
    return { search, plural, index: indexLoader(text.index) };
  };
  const mac = /Mac|iPhone|iPad/.test(navigator.userAgent);

  let options: HTMLAnchorElement[] = [];
  let selected = -1;

  const select = (i: number) => {
    options[selected]?.setAttribute('aria-selected', 'false');
    selected = i;
    const option = options[i];
    if (!option) return input.removeAttribute('aria-activedescendant');
    option.setAttribute('aria-selected', 'true');
    input.setAttribute('aria-activedescendant', option.id);
    option.scrollIntoView({ block: 'nearest' });
  };

  const option = ({ entry }: SearchResult) => {
    const a = template.content.firstElementChild!.cloneNode(true) as HTMLAnchorElement;
    a.id = `palette-option-${options.length}`;
    a.href = entry.url;
    a.querySelector('[data-palette-title]')!.textContent = entry.title;
    a.querySelector('[data-palette-date]')!.textContent = entry.date;
    options.push(a);
    return a;
  };

  const show = (results: SearchResult[], query: string) => {
    selected = -1;
    options = [];
    for (const g of groups) {
      const own = results.filter((r) => r.entry.kind === g.kind && r.entry.url.startsWith('/'));
      g.list.replaceChildren(...own.map(option));
      g.count.textContent = own.length ? String(own.length) : '';
      g.group.hidden = own.length === 0;
    }
    listbox.hidden = options.length === 0;
    input.setAttribute('aria-expanded', String(options.length > 0));
    all.hidden = options.length === 0;
    all.href = `${text.page}?${new URLSearchParams({ q: query.trim() })}`;
    select(options.length ? 0 : -1);
  };

  const report = (message: string, visible = true) => {
    status.textContent = message;
    status.classList.toggle('sr-only', !visible);
  };

  let latest = 0;
  const run = async (query: string) => {
    const ticket = ++latest;
    none.hidden = true;
    if (!query.trim()) {
      show([], query);
      return report('');
    }
    try {
      const { search, plural, index } = await (engine ??= load().catch((e) => {
        engine = undefined;
        throw e;
      }));
      if (!index.loaded()) report(text.loading);
      const results = search(await index.load(), query);
      if (ticket !== latest) return;
      show(results, query);
      none.hidden = options.length > 0;
      report(options.length ? plural({ one: text.one, other: text.other }, options.length) : text.none, options.length > 0);
    } catch {
      if (ticket === latest) report(text.failed);
    }
  };

  let opener: Element | null = null;
  const open = () => {
    const page = document.querySelector<HTMLInputElement>('#search-query');
    if (page && !page.closest('[hidden]')) {
      page.focus();
      return page.select();
    }
    if (dialog.open) return;
    opener = document.activeElement;
    dialog.showModal();
    input.select();
  };

  dialog.addEventListener('close', () => {
    if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
  });
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) dialog.close();
  });
  listbox.addEventListener('click', () => dialog.close());
  listbox.addEventListener('pointermove', (e) => {
    const i = options.indexOf((e.target as Element).closest<HTMLAnchorElement>('[role="option"]')!);
    if (i !== -1 && i !== selected) select(i);
  });

  input.addEventListener('input', () => run(input.value));
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (options.length) select((selected + (e.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length);
    } else if (e.key === 'Enter' && !e.isComposing && options[selected]) {
      e.preventDefault();
      options[selected].click();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      dialog.close();
    }
  });

  const typing = (target: EventTarget | null) =>
    target instanceof HTMLElement && (target.isContentEditable || target.matches('input, textarea, select'));

  document.addEventListener('keydown', (e) => {
    if ((mac ? e.metaKey : e.ctrlKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      if (dialog.open) dialog.close();
      else open();
    } else if (e.key === '/' && !e.metaKey && !e.ctrlKey && !e.altKey && !dialog.open && !typing(e.target)) {
      e.preventDefault();
      open();
    }
  });

  if (matchMedia('(pointer: fine)').matches) {
    for (const hint of document.querySelectorAll<HTMLElement>('[data-palette-hint]')) {
      hint.textContent = mac ? '⌘K' : 'Ctrl K';
      hint.hidden = false;
    }
    for (const link of document.querySelectorAll<HTMLAnchorElement>('[data-palette-open]')) {
      link.setAttribute('aria-keyshortcuts', mac ? 'Meta+K /' : 'Control+K /');
      link.addEventListener('click', (e) => {
        if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        open();
      });
    }
  }
}
