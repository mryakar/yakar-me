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
  location: { lat: number; lon: number };
  recipe?: Recipe;
}

export const seriesPath = (series: string) => `/photos/${series}/`;
export const variantPath = (file: string) => `/img/${file}`;

export const signed = (n: number, zero = '0') => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : zero);

export const aperture = (f: number) => `f/${f}`;

export function shutter(seconds: number) {
  if (seconds < 0.3) return `1/${Math.round(1 / seconds)}`;
  return `${Number(seconds.toFixed(1))}s`;
}

export const focalLength = (shot: Pick<Shot, 'kind' | 'focalLength'>) =>
  shot.kind === 'phone' ? `${shot.focalLength}mm eq.` : `${shot.focalLength}mm`;

export const takenYear = (taken: string) => Number(taken.slice(0, 4));

export function coordinates({ lat, lon }: { lat: number; lon: number }) {
  const dms = (v: number, pos: string, neg: string) => {
    const total = Math.round(Math.abs(v) * 3600);
    const d = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d}°${pad(m)}′${pad(s)}″${v < 0 ? neg : pos}`;
  };
  return `${dms(lat, 'N', 'S')} ${dms(lon, 'E', 'W')}`;
}

export function recipeRows(r: Recipe) {
  const rows: [string, string][] = [];
  if (r.dynamicRange) rows.push(['Dynamic range', r.dynamicRange]);
  if (r.highlight !== undefined) rows.push(['Highlight', signed(r.highlight)]);
  if (r.shadow !== undefined) rows.push(['Shadow', signed(r.shadow)]);
  if (r.color !== undefined) rows.push(['Color', signed(r.color)]);
  if (r.monochromaticColor) rows.push(['Monochromatic color', `WC${signed(r.monochromaticColor[0], '+0')} MG${signed(r.monochromaticColor[1], '+0')}`]);
  if (r.whiteBalance) {
    const [red, blue] = r.whiteBalanceShift ?? [0, 0];
    rows.push(['White balance', `${r.whiteBalance} · R${signed(red, '+0')} B${signed(blue, '+0')}`]);
  }
  if (r.noiseReduction !== undefined) rows.push(['Noise reduction', signed(r.noiseReduction)]);
  if (r.clarity !== undefined) rows.push(['Clarity', signed(r.clarity)]);
  if (r.grain) rows.push(['Grain', r.grain]);
  if (r.colorChrome) rows.push(['Color chrome', r.colorChrome]);
  if (r.colorChromeBlue) rows.push(['Color chrome FX blue', r.colorChromeBlue]);
  return rows;
}

export const copyrightNotice = (year: number) => `© ${year} ${PHOTOGRAPHER}. All rights reserved.`;

export function imageObject(o: { url: string; page: string; caption: string; taken: string; width: number; height: number }) {
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
    copyrightNotice: copyrightNotice(takenYear(o.taken)),
  };
}

export const jsonLd = (data: unknown) =>
  JSON.stringify(data).replace(/[<>&\u2028\u2029]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`);
