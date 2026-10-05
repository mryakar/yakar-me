import { ui } from '../i18n/ui.ts';
import { site } from '../site.ts';
import { escapeXml, formatDate } from './format.ts';
import type { Lang } from './i18n.ts';

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_DIR = '/og/';

export const OG_COLORS = {
  bg: '#08090a',
  glow: '#15161a',
  text: '#ededef',
  muted: '#9a9ea6',
  faint: '#7e828a',
  accent: '#c8a465',
  line: 'rgb(255 255 255 / 0.07)',
};

export const OG_FONTS = {
  display: ['@fontsource/instrument-serif/files/instrument-serif-latin-400-normal.woff2', '@fontsource/instrument-serif/files/instrument-serif-latin-ext-400-normal.woff2'],
  mono: ['@fontsource-variable/geist-mono/files/geist-mono-latin-wght-normal.woff2', '@fontsource-variable/geist-mono/files/geist-mono-latin-ext-wght-normal.woff2'],
};

const LATIN = 'U+0000-00FF, U+0131, U+0152-0153, U+2000-206F';
const LATIN_EXT = 'U+0100-0130, U+0132-0151, U+0154-024F';

export interface OgCard {
  slug: string;
  lang: Lang;
  label: string;
  title: string;
}

export function articleCard(a: { id: string; title: string; topic: string; pubDate: Date }, lang: Lang): OgCard {
  const topic = ui[lang].writing.topics[a.topic];
  return { slug: a.id, lang, label: `${topic} · ${formatDate(a.pubDate, 'short', lang)}`.toLocaleLowerCase(lang), title: a.title };
}

export const titleSize = (title: string) => (title.length <= 36 ? 88 : title.length <= 52 ? 76 : 66);

export function ogCardHtml(card: OgCard, asset: (path: string) => string) {
  const c = OG_COLORS;
  const face = (family: string, [latin, ext]: string[]) =>
    `@font-face{font-family:${family};src:url(${asset(latin)});unicode-range:${LATIN}}` +
    `@font-face{font-family:${family};src:url(${asset(ext)});unicode-range:${LATIN_EXT}}`;
  const css =
    face('display', OG_FONTS.display) +
    face('mono', OG_FONTS.mono) +
    `*{margin:0;box-sizing:border-box}` +
    `body{width:${OG_SIZE.width}px;height:${OG_SIZE.height}px;display:flex;flex-direction:column;padding:72px 84px 64px;` +
    `background:radial-gradient(120% 120% at 15% 0%,${c.glow} 0%,${c.bg} 60%);color:${c.text}}` +
    `.label{font-family:mono;font-size:22px;letter-spacing:.04em;color:${c.accent}}.label span{color:${c.faint}}` +
    `h1{margin:auto 0;max-width:1000px;font-family:display;font-weight:400;font-size:${titleSize(card.title)}px;` +
    `line-height:1.04;letter-spacing:-.01em;text-wrap:balance}` +
    `footer{display:flex;align-items:center;justify-content:space-between;padding-top:28px;border-top:1px solid ${c.line}}` +
    `.name{font-family:display;font-size:36px}` +
    `.site{display:flex;align-items:center;gap:24px;font-family:mono;font-size:20px;letter-spacing:.12em;color:${c.muted}}` +
    `.site img{width:64px;height:64px}`;
  const [topic, date] = card.label.split(' · ');
  return (
    `<!doctype html><html lang="${card.lang}"><meta charset="utf-8"><style>${css}</style><body>` +
    `<div class="label">${escapeXml(topic)} <span>·</span> ${escapeXml(date)}</div>` +
    `<h1>${escapeXml(card.title)}</h1>` +
    `<footer><div class="name">${escapeXml(site.name)}</div>` +
    `<div class="site">${escapeXml(site.domain.toUpperCase())}<img src="${asset('favicon.svg')}" alt=""></div></footer></body></html>`
  );
}

export async function ogImagePathFor(card: OgCard) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ogCardHtml(card, (path) => path)));
  const hash = [...new Uint8Array(digest).slice(0, 4)].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${OG_DIR}${card.slug}-${card.lang}-${hash}.png`;
}
