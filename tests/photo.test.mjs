import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aperture, countries, focalLength, imageObject, placeName, jsonLd, recipeRows, seriesPath, shutter, signed, takenYear } from '../src/lib/photo.ts';
import { ui } from '../src/i18n/ui.ts';

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

test('placeName: semt, şehir, ülke; ardışık tekrar düşer', () => {
  assert.equal(placeName({ district: 'Bophut', city: 'Ko Samui', country: 'Thailand' }), 'Bophut, Ko Samui, Thailand');
  assert.equal(placeName({ district: 'Mong Kok', city: 'Hong Kong', country: 'Hong Kong' }), 'Mong Kok, Hong Kong');
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
    ['dynamicRange', 'DR200'], ['highlight', '−1'], ['shadow', '−1'], ['color', '+2'], ['whiteBalance', 'Auto · R+0 B−2'],
  ]);
  assert.deepEqual(recipeRows({ filmSimulation: 'Acros' }), []);
});

test('recipeRows: Türkçe değerler; DR ve Kelvin olduğu gibi; bilinmeyen değer build\'i kırar', () => {
  const t = ui.tr.photos.recipeValue;
  const rows = Object.fromEntries(recipeRows({
    filmSimulation: 'Eterna', dynamicRange: 'DR400', whiteBalance: 'Auto (white priority)', whiteBalanceShift: [1, 0],
    grain: 'Weak, Small', colorChrome: 'Strong', colorChromeBlue: 'Off',
  }, t));
  assert.equal(rows.dynamicRange, 'DR400');
  assert.equal(rows.whiteBalance, 'Otomatik (beyaz öncelikli) · R+1 B+0');
  assert.equal(rows.grain, 'Zayıf, Küçük');
  assert.equal(rows.colorChrome, 'Güçlü');
  assert.equal(rows.colorChromeBlue, 'Kapalı');
  assert.equal(recipeRows({ filmSimulation: 'Provia', whiteBalance: '5600K' }, t)[0][1], '5600K · R+0 B+0');
  assert.throws(() => recipeRows({ filmSimulation: 'Provia', grain: 'Medium' }, t), /No Turkish recipe value for "Medium"/);
});

test('recipeRows: foto task\'ının yazabileceği her değerin Türkçesi var', async () => {
  const src = (await import('node:fs')).readFileSync('scripts/lib/photo-record.mjs', 'utf8');
  const tables = ['WHITE_BALANCE', 'EFFECT', 'GRAIN_SIZE', 'DRANGE_PRIORITY'].map((name) => {
    const body = new RegExp(`const ${name} = \\{([\\s\\S]*?)\\};`).exec(src)[1];
    return [name, [...body.matchAll(/'([^']+)'/g)].map((m) => m[1])];
  });
  for (const [name, values] of tables) {
    assert.ok(values.length > 0, name);
    for (const v of values) ui.tr.photos.recipeValue(name === 'DRANGE_PRIORITY' ? `D-Range Priority ${v}` : v);
  }
  ui.tr.photos.recipeValue('DR Auto');
});

test('Türkçe: yer adında ülke çevrilir, ardışık tekrar yine düşer; bilinmeyen ülke kırar', () => {
  const c = ui.tr.photos.country;
  assert.equal(placeName({ district: 'Bophut', city: 'Koh Samui', country: 'Thailand' }, c), 'Bophut, Koh Samui, Tayland');
  assert.equal(placeName({ district: 'Mong Kok', city: 'Hong Kong', country: 'Hong Kong' }, c), 'Mong Kok, Hong Kong');
  assert.equal(placeName({ district: 'Chinatown', city: 'Singapore', country: 'Singapore' }, c), 'Chinatown, Singapur');
  assert.equal(placeName({ district: 'Sonneberg', city: 'Sonneberg', country: 'Germany' }, c), 'Sonneberg, Almanya');
  assert.throws(() => placeName({ district: 'A', city: 'B', country: 'Atlantis' }, c), /No Turkish country name/);
});

test('Türkçe: seri adresi, eşdeğer odak, telif notu', () => {
  assert.equal(seriesPath('hong-kong'), '/photos/hong-kong/');
  assert.equal(seriesPath('hong-kong', 'tr'), '/tr/photos/hong-kong/');
  assert.equal(focalLength({ kind: 'phone', focalLength: 24 }, ui.tr.photos.equivalent), '24mm eşd.');
  const o = imageObject({ url: 'u', page: 'p', caption: 'Şişli & <İ>', taken: '2025-05-01T10:00:00+08:00', width: 1, height: 1,
    notice: (y) => ui.tr.photos.copyright(y, 'Ahmet Yakar') });
  assert.equal(o.copyrightNotice, '© 2025 Ahmet Yakar. Tüm hakları saklıdır.');
  const out = jsonLd(o);
  assert.doesNotMatch(out, /[<>&]/);
  assert.equal(JSON.parse(out).caption, 'Şişli & <İ>');
});

test('jsonLd: </script> ve HTML karakterleri kaçırılır, JSON geçerli kalır', () => {
  const data = { caption: '</script><script>alert(1)</script> & \u2028' };
  const out = jsonLd(data);
  assert.doesNotMatch(out, /[<>&\u2028]/);
  assert.deepEqual(JSON.parse(out), data);
});

test('countries: farklı ülkeler, ilk görülme sırasıyla', () => {
  const at = (city, country) => ({ district: 'x', city, country });
  assert.deepEqual(countries([at('Ubud', 'Indonesia'), at('Canggu', 'Indonesia')]), ['Indonesia']);
  assert.deepEqual(countries([at('Nice', 'France'), at('Coburg', 'Germany'), at('Paris', 'France')]), ['France', 'Germany']);
});
