import { nav, paths, sections } from '../site.ts';
import { ui } from '../i18n/ui.ts';
import { localize, type Lang } from './i18n.ts';

export function navLinks(path: string, lang: Lang) {
  const home = localize(paths.home, lang);
  return nav.map((key) => {
    const url = localize(paths[key], lang);
    return { href: url, label: ui[lang].nav[key], current: url === home ? path === home : path.startsWith(url) };
  });
}

export const sectionLinks = (lang: Lang) =>
  sections.map((key) => ({ key, href: localize(paths[key], lang), label: ui[lang].nav[key] }));
