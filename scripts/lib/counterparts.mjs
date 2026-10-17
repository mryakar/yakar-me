import { defaultLang, localize, locales, splitPath } from '../../src/lib/i18n.ts';
import { site } from '../../src/site.ts';

export const ORIGIN = site.url;

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
  const waiting = locales.flatMap((l) => pending[l].map((p) => localize(p, l)));
  if (complete && waiting.length) errors.push(`${waiting.length} translation(s) pending: ${waiting.join(', ')}`);
  for (const [page, html] of pages) {
    const { path } = splitPath(page);
    const present = locales.filter((l) => pages.has(localize(path, l)));
    for (const l of locales) {
      const isPending = pending[l].includes(path);
      if (!present.includes(l) && !isPending) errors.push(`${page}: no counterpart at ${localize(path, l)}`);
      if (present.includes(l) && isPending)
        errors.push(`${page}: listed as pending in ${l} but ${localize(path, l)} exists`);
    }

    const links = hreflangs(html);
    for (const [lang, href] of links) {
      if (!href?.startsWith(`${ORIGIN}/`)) errors.push(`${page}: hreflang ${lang} points outside the site: ${href}`);
      else if (!pages.has(new URL(href).pathname))
        errors.push(`${page}: hreflang ${lang} target does not exist: ${href}`);
    }
    const expected =
      present.length < 2
        ? []
        : [
            ...present.map((l) => [l, `${ORIGIN}${localize(path, l)}`]),
            ...(present.includes(defaultLang) ? [['x-default', `${ORIGIN}${localize(path, defaultLang)}`]] : []),
          ];
    const key = (pairs) =>
      pairs
        .map(([l, h]) => `${l} ${h}`)
        .sort()
        .join('\n');
    if (key(links) !== key(expected)) {
      errors.push(
        `${page}: hreflang set is [${links.map(([l]) => l).join(', ')}], expected [${expected.map(([l]) => l).join(', ')}]`,
      );
    }
  }
  return errors;
}
