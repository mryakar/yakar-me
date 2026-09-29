import { nav } from '../site.ts';
import { ui } from '../i18n/ui.ts';
import { localize, type Lang } from './i18n.ts';

export function navLinks(path: string, lang: Lang) {
  const home = localize('/', lang);
  return nav.map(({ key, href }) => {
    const url = localize(href, lang);
    return { href: url, label: ui[lang].nav[key], current: url === home ? path === home : path.startsWith(url) };
  });
}
