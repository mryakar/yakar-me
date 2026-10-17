import { FINE_ARM, MARK, MARK_RATIO, MARK_VIEWBOX } from './mark-drawing.ts';
import { PAGE_BACKGROUND } from './theme.ts';

export interface Stroke {
  d: string;
  width: number;
}

export interface Drawing {
  arm: Stroke;
  stem: Stroke;
}

export const BOX = { size: 32, radius: 7, ground: PAGE_BACKGROUND.dark, ink: '#c8a465' };

export const strokes = (drawing: Drawing, fine = false) => [
  { d: drawing.arm.d, width: fine ? FINE_ARM : drawing.arm.width },
  { d: drawing.stem.d, width: drawing.stem.width },
];

const STROKE_ATTRS = 'fill="none" stroke-linecap="round" stroke-linejoin="round"';

const paths = (drawing: Drawing, ink: string) =>
  `<g ${STROKE_ATTRS} stroke="${ink}">` +
  strokes(drawing)
    .map((s) => `<path d="${s.d}" stroke-width="${s.width}"/>`)
    .join('') +
  '</g>';

export const markSvg = (opts: { width: number; ink: string }) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${opts.width}" height="${Math.round(opts.width * MARK_RATIO)}" viewBox="${MARK_VIEWBOX}" aria-hidden="true">` +
  paths(MARK, opts.ink) +
  '</svg>';

export const iconSvg = (opts: { drawing: Drawing; size?: number; rounded?: boolean }) =>
  `<svg xmlns="http://www.w3.org/2000/svg" ${opts.size ? `width="${opts.size}" height="${opts.size}" ` : ''}viewBox="0 0 ${BOX.size} ${BOX.size}">` +
  `<rect width="${BOX.size}" height="${BOX.size}"${opts.rounded === false ? '' : ` rx="${BOX.radius}"`} fill="${BOX.ground}"/>` +
  paths(opts.drawing, BOX.ink) +
  '</svg>';
