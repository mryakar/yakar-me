import { plural } from '../lib/format';
import { QUERY_MAX, search, type SearchResult } from '../lib/search';
import { replaceQuery } from './history';
import { indexLoader } from './search-index';

const root = document.querySelector<HTMLElement>('[data-search]');

if (root) {
  const text = root.dataset as Record<'index' | 'one' | 'other' | 'none' | 'loading' | 'failed', string>;
  const input = root.querySelector<HTMLInputElement>('#search-query')!;
  const status = root.querySelector<HTMLElement>('[data-search-status]')!;
  const item = root.querySelector<HTMLTemplateElement>('[data-search-item]')!;
  const groups = new Map(
    [...root.querySelectorAll<HTMLElement>('[data-search-group]')].map((g) => [
      g.dataset.searchGroup!,
      {
        section: g,
        count: g.querySelector<HTMLElement>('[data-search-count]')!,
        list: g.querySelector<HTMLElement>('[data-search-list]')!,
      },
    ]),
  );

  const index = indexLoader(text.index);

  const row = ({ entry, snippet }: SearchResult) => {
    const li = item.content.firstElementChild!.cloneNode(true) as HTMLElement;
    li.querySelector<HTMLAnchorElement>('[data-search-link]')!.href = entry.url;
    li.querySelector('[data-search-title]')!.textContent = entry.title;
    li.querySelector('[data-search-snippet]')!.append(
      ...snippet.map((s) => {
        if (!s.mark) return document.createTextNode(s.text);
        const mark = document.createElement('mark');
        mark.textContent = s.text;
        return mark;
      }),
    );
    return li;
  };

  const show = (results: SearchResult[]) => {
    for (const [kind, g] of groups) {
      const own = results.filter((r) => r.entry.kind === kind && r.entry.url.startsWith('/'));
      g.list.replaceChildren(...own.map(row));
      g.count.textContent = own.length ? String(own.length) : '';
      g.section.hidden = own.length === 0;
    }
  };

  const remember = (query: string) => {
    const params = new URLSearchParams(location.search);
    if (query) params.set('q', query);
    else params.delete('q');
    replaceQuery(params.toString());
  };

  let latest = 0;
  const run = async (query: string) => {
    const ticket = ++latest;
    remember(query.trim() ? query : '');
    if (!query.trim()) {
      show([]);
      status.textContent = '';
      return;
    }
    if (!index.loaded()) status.textContent = text.loading;
    try {
      const results = search(await index.load(), query);
      if (ticket !== latest) return;
      show(results);
      status.textContent = results.length ? plural({ one: text.one, other: text.other }, results.length) : text.none;
    } catch {
      if (ticket === latest) status.textContent = text.failed;
    }
  };

  root.querySelector<HTMLElement>('[data-search-fallback]')!.hidden = true;
  root.querySelector<HTMLElement>('[data-search-box]')!.hidden = false;
  input.addEventListener('input', () => run(input.value));
  const initial = (new URLSearchParams(location.search).get('q') ?? '').slice(0, QUERY_MAX);
  if (initial.trim()) {
    input.value = initial;
    run(initial);
  }
}
