import { isLang, locales, type Lang } from './i18n.ts';

type Section = 'writing' | 'photos';
type Status = 'original' | 'translated' | 'pending';

const contentPath = (section: Section, id: string) => `/${section}/${id}/`;

export function translationStatus(
  section: Section,
  originals: { id: string; lang: Lang }[],
  translationIds: string[],
  lang: Lang,
  pending: readonly string[],
): Map<string, Status> {
  const byId = new Map(originals.map((o) => [o.id, o]));
  const translated = new Set<string>();
  for (const tid of translationIds) {
    const [id, l] = tid.split('/');
    const original = byId.get(id);
    if (!original || !isLang(l)) throw new Error(`${section}: translation ${tid} has no original ${contentPath(section, id)}`);
    if (original.lang === l) throw new Error(`${section}: ${tid} is in the original's own language`);
    if (l === lang) translated.add(id);
  }
  const ids = new Set(originals.map((o) => o.id));
  for (const path of pending) {
    const m = /^\/(writing|photos)\/([^/]+)\/$/.exec(path);
    if (!m) throw new Error(`pending: ${path} is not a /writing/<slug>/ or /photos/<series>/ path`);
    if (m[1] === section && !ids.has(m[2])) throw new Error(`pending: ${path} does not exist`);
  }
  const status = new Map<string, Status>();
  for (const o of originals) {
    const isPending = pending.includes(contentPath(section, o.id));
    if (o.lang === lang) status.set(o.id, 'original');
    else if (translated.has(o.id) && isPending) throw new Error(`pending: ${contentPath(section, o.id)} is translated — remove it from the list`);
    else if (translated.has(o.id)) status.set(o.id, 'translated');
    else if (isPending) status.set(o.id, 'pending');
    else throw new Error(`${contentPath(section, o.id)} has no ${lang} translation — add ${o.id}/${lang}.md or list it as pending`);
  }
  return status;
}

export function localized<O extends { id: string }, T extends { id: string }>(
  section: Section,
  originals: O[],
  langOf: (original: O) => Lang,
  translations: T[],
  lang: Lang,
  pending: Record<Lang, readonly string[]>,
) {
  const keys = originals.map((o) => ({ id: o.id, lang: langOf(o) }));
  const ids = translations.map((t) => t.id);
  const status = new Map(locales.map((l) => [l, translationStatus(section, keys, ids, l, pending[l])]));
  const here = status.get(lang)!;
  return originals
    .filter((o) => here.get(o.id) !== 'pending')
    .map((original) => ({
      original,
      translation: here.get(original.id) === 'translated' ? translations.find((t) => t.id === `${original.id}/${lang}`) : undefined,
      langs: locales.filter((l) => status.get(l)!.get(original.id) !== 'pending'),
    }));
}
