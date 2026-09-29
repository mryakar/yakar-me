import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PhotoError, cameraFrame, hasRecipe, location, parsePlace, photoId, readRecipe, readShot, takenAt } from '../scripts/lib/photo-record.mjs';

const fuji = {
  Make: 'FUJIFILM', Model: 'X-E5', LensModel: 'XF23mmF2.8 R WR', FNumber: 5.6, ExposureTime: 0.002941176471, ISO: 250,
  FocalLength: 23, FocalLengthIn35mmFormat: 35, DateTimeOriginal: '2026:08:30 13:01:14', OffsetTimeOriginal: '+03:00',
  GPSLatitude: 22.30727512, GPSLongitude: 114.16830667,
  FilmMode: 0x200, Saturation: 0x100, HighlightTone: 16, ShadowTone: 16, WhiteBalance: 0, WhiteBalanceFineTune: '0 -40',
  NoiseReduction: 0x200, Clarity: 0, GrainEffectRoughness: 0, GrainEffectSize: 0, ColorChromeEffect: 0, ColorChromeFXBlue: 0,
  DynamicRangeSetting: 1, DevelopmentDynamicRange: 200,
};
const iphone = {
  Make: 'Apple', Model: 'iPhone 11 Pro Max', LensModel: 'iPhone 11 Pro Max back triple camera 6mm f/2', FNumber: 2,
  ExposureTime: 0.000125, ISO: 25, FocalLength: 6, FocalLengthIn35mmFormat: 52, DateTimeOriginal: '2024:04:07 06:36:31',
};

test('readShot: Fuji gerçek odak uzaklığı ve lens', () => {
  assert.deepEqual(readShot(fuji), {
    kind: 'fujifilm', make: 'Fujifilm', model: 'X-E5', taken: '2026-08-30T13:01:14+03:00', aperture: 5.6,
    shutter: 0.002941176471, iso: 250, lens: 'XF23mmF2.8 R WR', focalLength: 23,
  });
});

test('readShot: telefonda 35 mm karşılığı, lens yok', () => {
  const s = readShot(iphone);
  assert.equal(s.kind, 'phone');
  assert.equal(s.focalLength, 52);
  assert.equal(s.lens, undefined);
  assert.equal(s.taken, '2024-04-07T06:36:31');
});

test('readShot: başka üretici reddedilir', () => {
  assert.throws(() => readShot({ ...fuji, Make: 'Canon' }), PhotoError);
});

test('readShot: tipsiz ya da uzun metin reddedilir', () => {
  assert.throws(() => readShot({ ...fuji, Model: '<script>alert(1)</script>'.repeat(4) }), PhotoError);
  assert.throws(() => readShot({ ...fuji, Model: 'X-E5\u0000' }), PhotoError);
  assert.throws(() => readShot({ ...fuji, ISO: 'high' }), PhotoError);
});

test('readRecipe: DSCF3236 değerleri; beyaz dengesi kayması 20\'ye bölünür', () => {
  assert.deepEqual(readRecipe(fuji), {
    filmSimulation: 'Velvia', dynamicRange: 'DR200', highlight: -1, shadow: -1, color: 2, whiteBalance: 'Auto',
    whiteBalanceShift: [0, -2], noiseReduction: -2, clarity: 0, grain: 'Off', colorChrome: 'Off', colorChromeBlue: 'Off',
  });
});

test('readRecipe: tek renkli film simülasyonu Saturation\'dan, Color satırı yok', () => {
  const r = readRecipe({ ...fuji, FilmMode: undefined, Saturation: 0x501 });
  assert.equal(r.filmSimulation, 'Acros + R');
  assert.equal(r.color, undefined);
});

test('readRecipe: bilinmeyen film simülasyonu reddedilir', () => {
  assert.throws(() => readRecipe({ ...fuji, FilmMode: 0x999 }), /FilmMode/);
});

test('readRecipe: gren, D-Range Priority, Kelvin', () => {
  const r = readRecipe({ ...fuji, GrainEffectRoughness: 32, GrainEffectSize: 32, DRangePriority: 0, DRangePriorityAuto: 2, WhiteBalance: 0xff0, ColorTemperature: 5600, HighlightTone: -8 });
  assert.equal(r.grain, 'Weak, Large');
  assert.equal(r.dynamicRange, 'D-Range Priority Strong');
  assert.equal(r.whiteBalance, '5600K');
  assert.equal(r.highlight, 0.5);
});

test('hasRecipe: Lightroom JPEG\'inde MakerNote yok', () => {
  const { FilmMode, Saturation, ...lightroom } = fuji;
  assert.equal(hasRecipe(fuji), true);
  assert.equal(hasRecipe(lightroom), false);
});

test('location: beş basamak; yoksa undefined', () => {
  assert.deepEqual(location(fuji), { lat: 22.30728, lon: 114.16831 });
  assert.equal(location(iphone), undefined);
  assert.throws(() => location({ GPSLatitude: 91, GPSLongitude: 0 }), PhotoError);
});

test('parsePlace: üç parça, kısa ASCII', () => {
  assert.deepEqual(parsePlace(' Mong Kok , Hong Kong,Hong Kong '), { district: 'Mong Kok', city: 'Hong Kong', country: 'Hong Kong' });
  assert.throws(() => parsePlace('Hong Kong'), PhotoError);
  assert.throws(() => parsePlace('Mong Kok, , Hong Kong'), PhotoError);
  assert.throws(() => parsePlace('Mong Kok, 香港, Hong Kong'), PhotoError);
});

test('takenAt: bozuk tarih reddedilir', () => {
  assert.throws(() => takenAt({ DateTimeOriginal: '0000:00:00' }), PhotoError);
});

test('photoId ve cameraFrame', () => {
  assert.equal(photoId('/x/IMG_2106.JPEG'), 'img-2106');
  assert.equal(photoId('DSCF1686.jpg'), 'dscf1686');
  assert.equal(cameraFrame('/x/DSCF1686.jpg'), 'DSCF1686');
  assert.equal(cameraFrame('IMG_2106.HEIC'), undefined);
});
