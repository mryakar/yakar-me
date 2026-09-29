import { test } from 'node:test';
import assert from 'node:assert/strict';
import { langPaths, localize, other, splitPath } from '../src/lib/i18n.ts';
import { bilingual, ui } from '../src/i18n/ui.ts';

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

test('çeviri etiketi ve öneri şeridi: her iki dilde İngilizce, iki yönde', () => {
  assert.equal(bilingual.translated.label('en'), 'Translated · EN');
  assert.equal(bilingual.translated.title('en'), 'Translated from English — read the original');
  assert.equal(bilingual.translated.title('tr'), 'Translated from Turkish — read the original');
  assert.equal(bilingual.hint.text('tr'), 'This page is also available in Turkish.');
  assert.equal(bilingual.hint.link('tr'), 'Read in Turkish');
  assert.equal(bilingual.hint.link('en'), 'Read in English');
});

test('langItemPaths: her dil için öğe yolları, dil öneki parametrede', async () => {
  const { langItemPaths } = await import('../src/lib/i18n.ts');
  const paths = await langItemPaths(async (lang) => (lang === 'en' ? ['a', 'b'] : ['a']), (id) => ({ slug: id }));
  assert.deepEqual(paths, [
    { params: { lang: undefined, slug: 'a' }, props: { lang: 'en', item: 'a' } },
    { params: { lang: undefined, slug: 'b' }, props: { lang: 'en', item: 'b' } },
    { params: { lang: 'tr', slug: 'a' }, props: { lang: 'tr', item: 'a' } },
  ]);
});

test('navLinks: dile göre adres ve etiket; ana sayfa yalnız kendisinde güncel', async () => {
  const { navLinks } = await import('../src/lib/nav.ts');
  const tr = navLinks('/tr/writing/x/', 'tr');
  assert.deepEqual(tr.map((l) => [l.href, l.label, l.current]), [
    ['/tr/', 'Ana sayfa', false],
    ['/tr/writing/', 'Yazılar', true],
    ['/tr/photos/', 'Fotoğraflar', false],
    ['/tr/about/', 'Hakkımda', false],
  ]);
  assert.equal(navLinks('/', 'en')[0].current, true);
  assert.equal(navLinks('/about/', 'en')[0].current, false);
});
