import { links, nav, paths, sections } from '../site.ts';
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

export const profileLinks = () => links.filter((l) => l.href.startsWith('https://'));

export function emailLink() {
  const link = links.find((l) => l.href.startsWith('mailto:'));
  if (!link) throw new Error('src/site.ts: links needs a mailto: address');
  return { href: link.href, address: link.href.slice('mailto:'.length) };
}
