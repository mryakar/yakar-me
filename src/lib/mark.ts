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

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

type Point = [number, number];

const segments = (d: string) => {
  const tokens = d.match(/[A-Za-z]|-?\d*\.?\d+/g) ?? [];
  const numbers = (from: number, n: number) => tokens.slice(from, from + n).map(Number);
  const result: Point[][] = [];
  let at: Point = [0, 0];
  for (let i = 0; i < tokens.length;) {
    const command = tokens[i];
    if (command === 'M') {
      const [x, y] = numbers(i + 1, 2);
      at = [x, y];
      i += 3;
    } else if (command === 'C') {
      const [x1, y1, x2, y2, x, y] = numbers(i + 1, 6);
      result.push([at, [x1, y1], [x2, y2], [x, y]]);
      at = [x, y];
      i += 7;
    } else throw new Error(`Unsupported path command "${command}" in "${d}"`);
  }
  return result;
};

const quadraticRoots = (a: number, b: number, c: number) => {
  if (Math.abs(a) < 1e-12) return Math.abs(b) < 1e-12 ? [] : [-c / b];
  const disc = b * b - 4 * a * c;
  if (disc < 0) return [];
  const r = Math.sqrt(disc);
  return [(-b + r) / (2 * a), (-b - r) / (2 * a)];
};

const cubicRange = (a: number, b: number, c: number, d: number) =>
  [0, 1, ...quadraticRoots(-a + 3 * b - 3 * c + d, 2 * (a - 2 * b + c), b - a).filter((t) => t > 0 && t < 1)].map(
    (t) => (1 - t) ** 3 * a + 3 * (1 - t) ** 2 * t * b + 3 * (1 - t) * t ** 2 * c + t ** 3 * d,
  );

export const inkBox = (marks: Stroke[]): Box => {
  const xs: number[] = [];
  const ys: number[] = [];
  for (const { d, width } of marks) {
    for (const [p0, p1, p2, p3] of segments(d)) {
      for (const x of cubicRange(p0[0], p1[0], p2[0], p3[0])) xs.push(x - width / 2, x + width / 2);
      for (const y of cubicRange(p0[1], p1[1], p2[1], p3[1])) ys.push(y - width / 2, y + width / 2);
    }
  }
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
};

export const viewBox = ({ x, y, width, height }: Box) =>
  [x, y, width, height].map((n) => Number(n.toFixed(3))).join(' ');

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
