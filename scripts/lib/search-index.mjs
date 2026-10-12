import { localize } from '../../src/lib/i18n.ts';
import { sections } from '../../src/site.ts';

const isText = (v) => typeof v === 'string';

export function searchIndexErrors(json, lang, page) {
  let entries;
  try {
    entries = JSON.parse(json);
  } catch {
    return ['not valid JSON'];
  }
  if (!Array.isArray(entries) || entries.length === 0) return ['not a non-empty list'];
  const errors = [];
  const prefix = localize('/', lang);
  const other = lang === 'en' ? /^\/[a-z]{2}\// : null;
  const seen = new Set();
  for (const e of entries) {
    const shape =
      e && sections.includes(e.kind) && isText(e.url) && isText(e.title) && e.title && isText(e.detail) && isText(e.body) &&
      Array.isArray(e.keywords) && e.keywords.every(isText);
    if (!shape) {
      errors.push(`malformed entry: ${JSON.stringify(e).slice(0, 80)}`);
      continue;
    }
    if (seen.has(e.url)) errors.push(`${e.url}: listed twice`);
    seen.add(e.url);
    const [path, id] = e.url.split('#');
    if (!path.startsWith(prefix) || (other && other.test(path))) {
      errors.push(`${e.url}: outside the ${lang} pages`);
      continue;
    }
    const html = page(path);
    if (html === undefined) errors.push(`${e.url}: no such page in the build`);
    else if (id !== undefined && !html.includes(` id="${id}"`)) errors.push(`${e.url}: no element with id "${id}" on the page`);
  }
  return errors;
}
