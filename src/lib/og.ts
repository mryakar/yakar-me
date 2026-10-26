import { ui } from '../i18n/ui.ts';
import { site } from '../site.ts';
import type { Topic } from './article.ts';
import type { Focus } from './photo.ts';
import { escapeXml, formatDate } from './format.ts';
import type { Lang } from './i18n.ts';
import { MARK } from './mark-drawing.ts';
import { iconSvg, markSvg } from './mark.ts';
import { PAGE_BACKGROUND } from './theme.ts';

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_DIR = '/og/';
export const OG_COVER_WIDTH = 1280;
export const ogSections = ['writing', 'photos', 'map', 'reading', 'playing', 'years', 'about'] as const;
export type OgSection = (typeof ogSections)[number];

export const OG_COLORS = {
  bg: PAGE_BACKGROUND.dark,
  glow: '#15161a',
  text: '#ededef',
  muted: '#9a9ea6',
  faint: '#7e828a',
  accent: '#c8a465',
  line: 'rgb(255 255 255 / 0.07)',
};

const OG_FONTS = {
  display: [
    '@fontsource/instrument-serif/files/instrument-serif-latin-400-normal.woff2',
    '@fontsource/instrument-serif/files/instrument-serif-latin-ext-400-normal.woff2',
  ],
  italic: [
    '@fontsource/instrument-serif/files/instrument-serif-latin-400-italic.woff2',
    '@fontsource/instrument-serif/files/instrument-serif-latin-ext-400-italic.woff2',
  ],
  mono: [
    '@fontsource-variable/geist-mono/files/geist-mono-latin-wght-normal.woff2',
    '@fontsource-variable/geist-mono/files/geist-mono-latin-ext-wght-normal.woff2',
  ],
};

const LATIN = 'U+0000-00FF, U+0131, U+0152-0153, U+2000-206F';
const LATIN_EXT = 'U+0100-0130, U+0132-0151, U+0154-024F';

interface ArticleCard {
  slug: string;
  lang: Lang;
  label: string;
  title: string;
}

interface HomeCard {
  slug: 'home';
  lang: Lang;
}

interface SeriesCard {
  slug: string;
  lang: Lang;
  label: string;
  title: string;
  image: string;
  focus: Focus;
}

interface SectionCard {
  slug: string;
  lang: Lang;
  label: string;
  title: string;
  section: OgSection;
}

type OgCard = ArticleCard | HomeCard | SeriesCard | SectionCard;

export interface SeriesCardInput {
  id: string;
  title: string;
  count: number;
  country: string;
  coverFile: string;
  focus?: Focus;
}

export function seriesCard(s: SeriesCardInput, lang: Lang): SeriesCard {
  const t = ui[lang].photos;
  return {
    slug: `series-${s.id}`,
    lang,
    label: `${t.count(s.count)} · ${t.country(s.country)}`,
    title: s.title,
    image: `/img/${s.coverFile}`,
    focus: s.focus ?? { x: 50, y: 50 },
  };
}

export function sectionCard(section: OgSection, lang: Lang): SectionCard {
  const t = ui[lang];
  const titles: Record<OgSection, string> = {
    writing: t.writing.description,
    photos: t.photos.description,
    map: t.map.description,
    reading: t.reading.description,
    playing: t.playing.description,
    years: t.description,
    about: t.about.description,
  };
  return {
    slug: `section-${section}`,
    lang,
    label: section === 'map' ? `${t.nav.photos} · ${t.photos.mapView}` : t.nav[section],
    title: titles[section],
    section,
  };
}

export function articleCard(a: { id: string; title: string; topic: Topic; pubDate: Date }, lang: Lang): ArticleCard {
  const topic = ui[lang].writing.topics[a.topic];
  return {
    slug: a.id,
    lang,
    label: `${topic} · ${formatDate(a.pubDate, 'short', lang)}`.toLocaleLowerCase(lang),
    title: a.title,
  };
}

export const homeCard = (lang: Lang): HomeCard => ({ slug: 'home', lang });

export const titleSize = (title: string) => (title.length <= 36 ? 88 : title.length <= 52 ? 76 : 66);

function baseCss(asset: (path: string) => string) {
  const c = OG_COLORS;
  const face = (family: string, [latin, ext]: string[], style = 'normal') =>
    `@font-face{font-family:${family};font-style:${style};src:url(${asset(latin)});unicode-range:${LATIN}}` +
    `@font-face{font-family:${family};font-style:${style};src:url(${asset(ext)});unicode-range:${LATIN_EXT}}`;
  return (
    face('display', OG_FONTS.display) +
    face('display', OG_FONTS.italic, 'italic') +
    face('mono', OG_FONTS.mono) +
    `*{margin:0;box-sizing:border-box}` +
    `body{width:${OG_SIZE.width}px;height:${OG_SIZE.height}px;display:flex;` +
    `background:radial-gradient(120% 120% at 15% 0%,${c.glow} 0%,${c.bg} 60%);color:${c.text}}` +
    `.label{font-family:mono;font-size:22px;letter-spacing:.04em;color:${c.accent}}.label span{color:${c.faint}}` +
    `h1{font-family:display;font-weight:400;letter-spacing:-.01em}`
  );
}

const page = (lang: Lang, css: string, body: string) =>
  `<!doctype html><html lang="${lang}"><meta charset="utf-8"><style>${css}</style><body>${body}</body></html>`;

function footerHtml() {
  const c = OG_COLORS;
  return (
    `footer{position:relative;display:flex;align-items:center;justify-content:space-between;padding-top:28px;border-top:1px solid ${c.line}}` +
    `.name{font-family:display;font-size:36px}` +
    `.site{display:flex;align-items:center;gap:24px;font-family:mono;font-size:20px;letter-spacing:.12em;color:${c.muted}}`
  );
}

const footer = () =>
  `<footer><div class="name">${escapeXml(site.name)}</div>` +
  `<div class="site">${escapeXml(site.domain.toUpperCase())}${iconSvg({ drawing: MARK, size: 64 })}</div></footer>`;

function articleHtml(card: ArticleCard, asset: (path: string) => string) {
  const css =
    baseCss(asset) +
    `body{flex-direction:column;padding:72px 84px 64px}` +
    `h1{margin:auto 0;max-width:1000px;font-size:${titleSize(card.title)}px;line-height:1.04;text-wrap:balance}` +
    footerHtml();
  const [topic, date] = card.label.split(' · ');
  return page(
    card.lang,
    css,
    `<div class="label">${escapeXml(topic)} <span>·</span> ${escapeXml(date)}</div>` +
      `<h1>${escapeXml(card.title)}</h1>` +
      footer(),
  );
}

function homeHtml(card: HomeCard, asset: (path: string) => string) {
  const c = OG_COLORS;
  const t = ui[card.lang];
  const [start, em, end] = t.home.hero;
  const css =
    baseCss(asset) +
    `body{padding:80px 84px 64px}` +
    `.text{display:flex;flex:1 1 auto;flex-direction:column;justify-content:space-between;min-width:0}` +
    `h1{max-width:720px;font-size:76px;line-height:1.04}h1 em{color:${c.accent}}` +
    `.byline{display:flex;align-items:baseline;gap:22px}` +
    `.name{font-family:display;font-size:34px}` +
    `.site{font-family:mono;font-size:18px;letter-spacing:.16em;color:${c.muted}}` +
    `.mark{display:flex;flex:0 0 300px;align-items:center;justify-content:center}`;
  return page(
    card.lang,
    css,
    `<div class="text"><div class="label">${escapeXml(t.tagline)}</div>` +
      `<h1>${escapeXml(start)}<em>${escapeXml(em)}</em>${escapeXml(end)}</h1>` +
      `<div class="byline"><div class="name">${escapeXml(site.name)}</div><div class="site">${escapeXml(site.domain.toUpperCase())}</div></div></div>` +
      `<div class="mark">${markSvg({ width: 260, ink: c.accent })}</div>`,
  );
}

function seriesHtml(card: SeriesCard, asset: (path: string) => string) {
  const c = OG_COLORS;
  const css =
    baseCss(asset) +
    `body{position:relative;flex-direction:column;justify-content:flex-end;padding:72px 84px 64px;background:${c.bg}}` +
    `img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:${card.focus.x}% ${card.focus.y}%}` +
    `.shade{position:absolute;inset:0;background:linear-gradient(180deg,rgb(8 9 10/.1) 0%,rgb(8 9 10/.45) 50%,rgb(8 9 10/.92) 100%)}` +
    `.text{position:relative;display:flex;flex-direction:column;gap:18px;padding-bottom:36px}` +
    `.label{color:${c.text}}.label span{color:${c.accent}}` +
    `h1{max-width:1000px;font-size:${titleSize(card.title)}px;line-height:1.04;text-wrap:balance}` +
    footerHtml();
  const [count, country] = card.label.split(' · ');
  return page(
    card.lang,
    css,
    `<img src="${escapeXml(asset(card.image))}" alt=""><div class="shade"></div>` +
      `<div class="text"><div class="label">${escapeXml(count)} <span>·</span> ${escapeXml(country)}</div>` +
      `<h1>${escapeXml(card.title)}</h1></div>` +
      footer(),
  );
}

function sectionHtml(card: SectionCard, asset: (path: string) => string) {
  const c = OG_COLORS;
  const css =
    baseCss(asset) +
    `body{padding:80px 84px 64px}` +
    `.text{display:flex;flex:1 1 auto;flex-direction:column;justify-content:space-between;min-width:0}` +
    `h1{max-width:720px;font-size:${titleSize(card.title)}px;line-height:1.06;text-wrap:balance}` +
    `.byline{display:flex;align-items:baseline;gap:22px}` +
    `.name{font-family:display;font-size:34px}` +
    `.site{font-family:mono;font-size:18px;letter-spacing:.16em;color:${c.muted}}` +
    `.mark{display:flex;flex:0 0 300px;align-items:center;justify-content:center}`;
  return page(
    card.lang,
    css,
    `<div class="text"><div class="label">${escapeXml(card.label)}</div>` +
      `<h1>${escapeXml(card.title)}</h1>` +
      `<div class="byline"><div class="name">${escapeXml(site.name)}</div><div class="site">${escapeXml(site.domain.toUpperCase())}</div></div></div>` +
      `<div class="mark">${markSvg({ width: 260, ink: c.accent })}</div>`,
  );
}

export function ogCardHtml(card: OgCard, asset: (path: string) => string) {
  if ('image' in card) return seriesHtml(card, asset);
  if ('section' in card) return sectionHtml(card, asset);
  if ('title' in card) return articleHtml(card, asset);
  return homeHtml(card, asset);
}

export async function ogImagePathFor(card: OgCard) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ogCardHtml(card, (path) => path)));
  const hash = [...new Uint8Array(digest).slice(0, 4)].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${OG_DIR}${card.slug}-${card.lang}-${hash}.png`;
}
