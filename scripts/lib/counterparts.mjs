import { defaultLang, localize, locales, splitPath } from '../../src/lib/i18n.ts';

export const ORIGIN = 'https://yakar.me';

export function pagePath(rel) {
  const p = rel.split('\\').join('/');
  if (/(^|\/)404\.html$/.test(p)) return null;
  if (p === 'index.html') return '/';
  if (p.endsWith('/index.html')) return `/${p.slice(0, -'index.html'.length)}`;
  return null;
}

const attr = (tag, name) => new RegExp(`\\s${name}="([^"]*)"`, 'i').exec(tag)?.[1];

export function hreflangs(html) {
  return [...html.matchAll(/<link\b[^>]*>/gi)]
    .map(([tag]) => tag)
    .filter((tag) => attr(tag, 'rel') === 'alternate' && attr(tag, 'hreflang'))
    .map((tag) => [attr(tag, 'hreflang'), attr(tag, 'href')]);
}

export function counterpartErrors(pages, pending, { complete = false } = {}) {
  const errors = [];
  if (complete && pending.length) errors.push(`${pending.length} translation(s) pending: ${pending.join(', ')}`);
  for (const [page, html] of pages) {
    const { path } = splitPath(page);
    const others = locales.map((l) => localize(path, l)).filter((p) => p !== page);
    const missing = others.filter((p) => !pages.has(p));
    const isPending = pending.includes(path);
    if (missing.length && !isPending) errors.push(`${page}: no counterpart at ${missing.join(', ')}`);
    if (!missing.length && isPending) errors.push(`${page}: listed as pending but every language exists`);

    const links = hreflangs(html);
    for (const [lang, href] of links) {
      if (!href?.startsWith(`${ORIGIN}/`)) errors.push(`${page}: hreflang ${lang} points outside the site: ${href}`);
      else if (!pages.has(new URL(href).pathname)) errors.push(`${page}: hreflang ${lang} target does not exist: ${href}`);
    }
    const expected = missing.length
      ? []
      : [...locales.map((l) => [l, `${ORIGIN}${localize(path, l)}`]), ['x-default', `${ORIGIN}${localize(path, defaultLang)}`]];
    const key = (pairs) => pairs.map(([l, h]) => `${l} ${h}`).sort().join('\n');
    if (key(links) !== key(expected)) {
      errors.push(`${page}: hreflang set is [${links.map(([l]) => l).join(', ')}], expected [${expected.map(([l]) => l).join(', ')}]`);
    }
  }
  return errors;
}
