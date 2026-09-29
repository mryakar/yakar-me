import { localize, type Lang } from './i18n.ts';

export const PHOTOGRAPHER = 'Ahmet Yakar';

export interface Recipe {
  filmSimulation: string;
  dynamicRange?: string;
  highlight?: number;
  shadow?: number;
  color?: number;
  monochromaticColor?: [number, number];
  whiteBalance?: string;
  whiteBalanceShift?: [number, number];
  noiseReduction?: number;
  clarity?: number;
  grain?: string;
  colorChrome?: string;
  colorChromeBlue?: string;
}

export interface Place {
  district: string;
  city: string;
  country: string;
}

export interface Shot {
  kind: 'fujifilm' | 'phone';
  make: string;
  model: string;
  lens?: string;
  taken: string;
  aperture: number;
  shutter: number;
  iso: number;
  focalLength: number;
  place: Place;
  recipe?: Recipe;
}

export const seriesPath = (series: string, lang: Lang = 'en') => localize(`/photos/${series}/`, lang);
export const variantPath = (file: string) => `/img/${file}`;

export const signed = (n: number, zero = '0') => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : zero);

export const aperture = (f: number) => `f/${f}`;

export function shutter(seconds: number) {
  if (seconds < 0.3) return `1/${Math.round(1 / seconds)}`;
  return `${Number(seconds.toFixed(1))}s`;
}

export const focalLength = (shot: Pick<Shot, 'kind' | 'focalLength'>, equivalent = 'eq.') =>
  shot.kind === 'phone' ? `${shot.focalLength}mm ${equivalent}` : `${shot.focalLength}mm`;

export const takenYear = (taken: string) => Number(taken.slice(0, 4));

const same = (s: string) => s;

export const placeName = ({ district, city, country }: Place, countryName = same) =>
  [district, city, countryName(country)].filter((part, i, parts) => part !== parts[i + 1]).join(', ');

export type RecipeRow = [keyof Omit<Recipe, 'filmSimulation' | 'whiteBalanceShift'>, string];

export function recipeRows(r: Recipe, value = same) {
  const rows: RecipeRow[] = [];
  if (r.dynamicRange) rows.push(['dynamicRange', value(r.dynamicRange)]);
  if (r.highlight !== undefined) rows.push(['highlight', signed(r.highlight)]);
  if (r.shadow !== undefined) rows.push(['shadow', signed(r.shadow)]);
  if (r.color !== undefined) rows.push(['color', signed(r.color)]);
  if (r.monochromaticColor) rows.push(['monochromaticColor', `WC${signed(r.monochromaticColor[0], '+0')} MG${signed(r.monochromaticColor[1], '+0')}`]);
  if (r.whiteBalance) {
    const [red, blue] = r.whiteBalanceShift ?? [0, 0];
    rows.push(['whiteBalance', `${value(r.whiteBalance)} · R${signed(red, '+0')} B${signed(blue, '+0')}`]);
  }
  if (r.noiseReduction !== undefined) rows.push(['noiseReduction', signed(r.noiseReduction)]);
  if (r.clarity !== undefined) rows.push(['clarity', signed(r.clarity)]);
  if (r.grain) rows.push(['grain', r.grain.split(', ').map(value).join(', ')]);
  if (r.colorChrome) rows.push(['colorChrome', value(r.colorChrome)]);
  if (r.colorChromeBlue) rows.push(['colorChromeBlue', value(r.colorChromeBlue)]);
  return rows;
}

export const copyrightNotice = (year: number) => `© ${year} ${PHOTOGRAPHER}. All rights reserved.`;

export function imageObject(o: {
  url: string;
  page: string;
  caption: string;
  taken: string;
  width: number;
  height: number;
  notice?: (year: number) => string;
}) {
  return {
    '@type': 'ImageObject',
    contentUrl: o.url,
    url: o.page,
    caption: o.caption,
    width: o.width,
    height: o.height,
    dateCreated: o.taken,
    creator: { '@type': 'Person', name: PHOTOGRAPHER },
    creditText: PHOTOGRAPHER,
    copyrightHolder: { '@type': 'Person', name: PHOTOGRAPHER },
    copyrightYear: takenYear(o.taken),
    copyrightNotice: (o.notice ?? copyrightNotice)(takenYear(o.taken)),
  };
}

export const jsonLd = (data: unknown) =>
  JSON.stringify(data).replace(/[<>&\u2028\u2029]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`);
