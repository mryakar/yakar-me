import { test } from 'node:test';
import assert from 'node:assert/strict';
import { langPaths, localize, other, splitPath } from '../src/lib/i18n.ts';
import { ui } from '../src/i18n/ui.ts';

test('localize: İngilizce kökte, Türkçe /tr/ önekiyle', () => {
  assert.equal(localize('/', 'en'), '/');
  assert.equal(localize('/', 'tr'), '/tr/');
  assert.equal(localize('/writing/x/', 'tr'), '/tr/writing/x/');
});

test('splitPath: dil ve dilden bağımsız yol', () => {
  assert.deepEqual(splitPath('/tr/'), { lang: 'tr', path: '/' });
  assert.deepEqual(splitPath('/tr/photos/hong-kong/'), { lang: 'tr', path: '/photos/hong-kong/' });
  assert.deepEqual(splitPath('/writing/tr/'), { lang: 'en', path: '/writing/tr/' });
  assert.deepEqual(splitPath('/en/'), { lang: 'en', path: '/en/' });
  assert.deepEqual(splitPath('/trx/'), { lang: 'en', path: '/trx/' });
});

test('other ve langPaths', () => {
  assert.equal(other('en'), 'tr');
  assert.equal(other('tr'), 'en');
  assert.deepEqual(langPaths(), [
    { params: { lang: undefined }, props: { lang: 'en' } },
    { params: { lang: 'tr' }, props: { lang: 'tr' } },
  ]);
});

const shape = (o) =>
  Object.fromEntries(Object.entries(o).map(([k, v]) => [k, v && typeof v === 'object' && !Array.isArray(v) ? shape(v) : typeof v]));

test('arayüz sözlüğü: iki dilde aynı anahtarlar, boş metin yok', () => {
  assert.deepEqual(shape(ui.tr), shape(ui.en));
  const strings = (o) => Object.values(o).flatMap((v) => (typeof v === 'string' ? [v] : v && typeof v === 'object' ? strings(v) : []));
  const { now, ...rest } = ui.tr;
  for (const s of strings(rest)) assert.ok(s.length > 0, JSON.stringify(s));
  assert.equal(now.length, ui.en.now.length);
  for (const item of now) assert.ok(item.label && item.rest);
});

test('çeviri etiketi: özgün dil kodu ve adı', () => {
  assert.equal(ui.tr.translated.label('en'), 'Çeviri · EN');
  assert.equal(ui.tr.translated.title('en'), 'İngilizceden çevrildi — özgün sürümü oku');
  assert.equal(ui.en.translated.title('tr'), 'Translated from Turkish — read the original');
});
