import sharp from 'sharp';
import { ARTIST, MAX_SIDE, copyrightText } from './image-meta.mjs';

export const WIDTHS = [320, 640, 1280, 1920, 2560];
export const FORMATS = {
  avif: { quality: 50, effort: 2 },
  webp: { quality: 75 },
};
const INPUT_PIXEL_LIMIT = 120_000_000;

export async function decode(input) {
  const { data, info } = await sharp(input, { limitInputPixels: INPUT_PIXEL_LIMIT, failOn: 'error' })
    .rotate()
    .toColourspace('srgb')
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { data, info };
}

export function targetWidths(width, height) {
  const out = new Set();
  for (const w of WIDTHS) {
    const scale = Math.min(w / width, MAX_SIDE / height, MAX_SIDE / width, 1);
    out.add(Math.floor(width * scale));
  }
  return [...out].sort((a, b) => a - b);
}

export async function encode(decoded, width, format, year) {
  const { info } = decoded;
  const height = Math.round((info.height * width) / info.width);
  const buffer = await sharp(decoded.data, { raw: { width: info.width, height: info.height, channels: info.channels } })
    .resize(width, height)
    .withExif({ IFD0: { Artist: ARTIST, Copyright: copyrightText(year) } })
    [format](FORMATS[format])
    .toBuffer();
  return { buffer, width, height };
}

export async function encodeVariant(input, { width, format, year }) {
  return encode(await decode(input), width, format, year);
}
