import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pngChunks } from '../scripts/lib/png.mjs';
import { FINE_ARM, MARK, MARK_SMALL } from '../src/lib/mark-drawing.ts';
import { BOX, iconSvg, markSvg, strokes } from '../src/lib/mark.ts';

const css = readFileSync(new URL('../src/styles/global.css', import.meta.url), 'utf8');

test("BOX: zemin ve mürekkep koyu temanın --yk-bg ve --yk-accent'i", () => {
  const dark = (name) => new RegExp(`--yk-${name}: light-dark\\([^,]+,\\s*([^)]+)\\);`).exec(css)?.[1].trim();
  assert.equal(BOX.ground, dark('bg'));
  assert.equal(BOX.ink, dark('accent'));
});

test('strokes: ince kol yalnız sol kolu kalınlaştırır', () => {
  assert.deepEqual(
    strokes(MARK).map((s) => s.width),
    [MARK.arm.width, MARK.stem.width],
  );
  assert.deepEqual(
    strokes(MARK, true).map((s) => s.width),
    [FINE_ARM, MARK.stem.width],
  );
});

test('markSvg: harfe sıkı kutu, yükseklik orana göre', () => {
  const svg = markSvg({ width: 260, ink: '#c8a465' });
  assert.match(svg, /^<svg [^>]*width="260" height="277" viewBox="7 8.4 19.5 20.8"/);
  assert.match(svg, new RegExp(`stroke-width="${MARK.arm.width}"`));
});

test('iconSvg: kutu yuvarlak ya da köşesiz', () => {
  assert.match(iconSvg({ drawing: MARK }), /<rect width="32" height="32" rx="7" fill="#08090a"\/>/);
  assert.match(iconSvg({ drawing: MARK, rounded: false }), /<rect width="32" height="32" fill="#08090a"\/>/);
});

test("public/favicon.svg: kutu + küçük boyut çizimi, mark.ts'ten", () => {
  assert.equal(
    readFileSync(new URL('../public/favicon.svg', import.meta.url), 'utf8'),
    `${iconSvg({ drawing: MARK_SMALL })}\n`,
  );
});

const pub = (name) => readFileSync(new URL(`../public/${name}`, import.meta.url));
const size = (png) => [png.readUInt32BE(16), png.readUInt32BE(20)];

test("simge PNG'leri: boyut, yalnız IHDR/IDAT/IEND; apple-touch-icon saydamlıksız (RGB)", () => {
  for (const [name, px] of [
    ['apple-touch-icon.png', 180],
    ['feed.png', 144],
  ]) {
    const png = pub(name);
    assert.deepEqual(size(png), [px, px], name);
    assert.deepEqual([...new Set(pngChunks(png))].sort(), ['IDAT', 'IEND', 'IHDR'], name);
  }
  assert.equal(pub('apple-touch-icon.png')[25], 2);
});

test('favicon.ico: 16 ve 32 px PNG', () => {
  const ico = pub('favicon.ico');
  assert.deepEqual([ico.readUInt16LE(2), ico.readUInt16LE(4)], [1, 2]);
  const sizes = [0, 1].map((i) => {
    const at = 6 + 16 * i;
    const png = ico.subarray(ico.readUInt32LE(at + 12), ico.readUInt32LE(at + 12) + ico.readUInt32LE(at + 8));
    assert.deepEqual([...new Set(pngChunks(png))].sort(), ['IDAT', 'IEND', 'IHDR']);
    return size(png)[0];
  });
  assert.deepEqual(sizes, [16, 32]);
});
