import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aperture, coordinates, focalLength, jsonLd, recipeRows, shutter, signed, takenYear } from '../src/lib/photo.ts';

test('shutter: kesir ve saniye', () => {
  assert.equal(shutter(0.002941176471), '1/340');
  assert.equal(shutter(1 / 8000), '1/8000');
  assert.equal(shutter(0.25), '1/4');
  assert.equal(shutter(2), '2s');
});

test('aperture ve odak uzaklığı: Fuji gerçek, telefon 35 mm karşılığı', () => {
  assert.equal(aperture(5.6), 'f/5.6');
  assert.equal(focalLength({ kind: 'fujifilm', focalLength: 23 }), '23mm');
  assert.equal(focalLength({ kind: 'phone', focalLength: 52 }), '52mm eq.');
});

test('signed: eksi işareti U+2212, sıfır', () => {
  assert.equal(signed(2), '+2');
  assert.equal(signed(-1), '−1');
  assert.equal(signed(-0.5), '−0.5');
  assert.equal(signed(0), '0');
  assert.equal(signed(0, '+0'), '+0');
});

test('coordinates: derece-dakika-saniye, yarım küreler', () => {
  assert.equal(coordinates({ lat: 41.02556, lon: 28.97417 }), '41°01′32″N 28°58′27″E');
  assert.equal(coordinates({ lat: -8.48774, lon: 115.25925 }), '8°29′16″S 115°15′33″E');
  assert.equal(coordinates({ lat: 40.7128, lon: -74.006 }), '40°42′46″N 74°00′22″W');
});

test('takenYear: çekim yerindeki yıl', () => {
  assert.equal(takenYear('2026-01-01T00:30:00+08:00'), 2026);
});

test('recipeRows: tuvaldeki sıra ve biçim', () => {
  const rows = recipeRows({
    filmSimulation: 'Velvia', dynamicRange: 'DR200', highlight: -1, shadow: -1, color: 2, whiteBalance: 'Auto',
    whiteBalanceShift: [0, -2], noiseReduction: -2, clarity: 0, grain: 'Off', colorChrome: 'Off', colorChromeBlue: 'Off',
  });
  assert.deepEqual(rows.slice(0, 5), [
    ['Dynamic range', 'DR200'], ['Highlight', '−1'], ['Shadow', '−1'], ['Color', '+2'], ['White balance', 'Auto · R+0 B−2'],
  ]);
  assert.deepEqual(recipeRows({ filmSimulation: 'Acros' }), []);
});

test('jsonLd: </script> ve HTML karakterleri kaçırılır, JSON geçerli kalır', () => {
  const data = { caption: '</script><script>alert(1)</script> & \u2028' };
  const out = jsonLd(data);
  assert.doesNotMatch(out, /[<>&\u2028]/);
  assert.deepEqual(JSON.parse(out), data);
});
