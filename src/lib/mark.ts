import { PAGE_BACKGROUND } from './theme.ts';

export interface Stroke {
  d: string;
  width: number;
}

export interface Drawing {
  arm: Stroke;
  stem: Stroke;
}

export const MARK: Drawing = {
  arm: { d: 'M8.5 10.8 C11.8 9.6 13.8 12.4 16 19.6', width: 1.3 },
  stem: { d: 'M23.6 9.6 C19.8 13.8 17.3 18.4 16 22 C15 25 15.3 27 16.4 27 C17.5 27 17.5 24.6 16 22', width: 3 },
};

export const MARK_SMALL: Drawing = {
  arm: { d: 'M8.3 10.6 C11.8 9.4 13.8 12.4 16 19.6', width: 2.2 },
  stem: { d: 'M23.8 9.4 C19.8 13.8 17.3 18.4 16 21.8 C14.7 25.2 15 27.8 16.5 27.8 C18 27.8 18 24.8 16 21.8', width: 2.9 },
};

export const FINE_ARM = 1.6;

export const MARK_VIEWBOX = '7 8.4 19.5 20.8';
export const MARK_RATIO = 20.8 / 19.5;

export const BOX = { size: 32, radius: 7, ground: PAGE_BACKGROUND.dark, ink: '#c8a465' };

export const strokes = (drawing: Drawing, fine = false) => [
  { d: drawing.arm.d, width: fine ? FINE_ARM : drawing.arm.width },
  { d: drawing.stem.d, width: drawing.stem.width },
];

const STROKE_ATTRS = 'fill="none" stroke-linecap="round" stroke-linejoin="round"';

const paths = (drawing: Drawing, ink: string) =>
  `<g ${STROKE_ATTRS} stroke="${ink}">` + strokes(drawing).map((s) => `<path d="${s.d}" stroke-width="${s.width}"/>`).join('') + '</g>';

export const markSvg = (opts: { width: number; ink: string }) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${opts.width}" height="${Math.round(opts.width * MARK_RATIO)}" viewBox="${MARK_VIEWBOX}" aria-hidden="true">` +
  paths(MARK, opts.ink) +
  '</svg>';

export const iconSvg = (opts: { drawing: Drawing; size?: number; rounded?: boolean }) =>
  `<svg xmlns="http://www.w3.org/2000/svg" ${opts.size ? `width="${opts.size}" height="${opts.size}" ` : ''}viewBox="0 0 ${BOX.size} ${BOX.size}">` +
  `<rect width="${BOX.size}" height="${BOX.size}"${opts.rounded === false ? '' : ` rx="${BOX.radius}"`} fill="${BOX.ground}"/>` +
  paths(opts.drawing, BOX.ink) +
  '</svg>';
