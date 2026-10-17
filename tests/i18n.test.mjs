import { test } from 'node:test';
import assert from 'node:assert/strict';
import { langPaths, localize, splitPath } from '../src/lib/i18n.ts';
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

test('langPaths: her dil, İngilizce kökte', () => {
  assert.deepEqual(langPaths(), [
    { params: { lang: undefined }, props: { lang: 'en' } },
    { params: { lang: 'tr' }, props: { lang: 'tr' } },
    { params: { lang: 'es' }, props: { lang: 'es' } },
  ]);
});

const shape = (o) =>
  Object.fromEntries(
    Object.entries(o).map(([k, v]) => [k, v && typeof v === 'object' && !Array.isArray(v) ? shape(v) : typeof v]),
  );

test('arayüz sözlüğü: her dilde aynı anahtarlar, boş metin yok', () => {
  const strings = (o) =>
    Object.values(o).flatMap((v) => (typeof v === 'string' ? [v] : v && typeof v === 'object' ? strings(v) : []));
  for (const lang of ['tr', 'es']) {
    assert.deepEqual(shape(ui[lang]), shape(ui.en));
    for (const s of strings(ui[lang])) assert.ok(s.length > 0, JSON.stringify(s));
    assert.equal(ui[lang].now.length, ui.en.now.length);
    assert.equal(ui[lang].playing.levels.length, ui.en.playing.levels.length);
  }
});

test('çeviri etiketi ve öneri şeridi: her iki dilde İngilizce, iki yönde', () => {
  assert.equal(bilingual.translated.label('en'), 'Translated · EN');
  assert.equal(bilingual.translated.title('en'), 'Translated from English — read the original');
  assert.equal(bilingual.translated.title('tr'), 'Translated from Turkish — read the original');
  assert.equal(bilingual.hint.text('tr'), 'This page is also available in Turkish.');
  assert.equal(bilingual.hint.link('tr'), 'Read in Turkish');
  assert.equal(bilingual.hint.link('en'), 'Read in English');
  assert.equal(bilingual.hint.text('es'), 'This page is also available in Spanish.');
});

test('langItemPaths: her dil için öğe yolları, dil öneki parametrede', async () => {
  const { langItemPaths } = await import('../src/lib/i18n.ts');
  const paths = await langItemPaths(
    async (lang) => (lang === 'en' ? ['a', 'b'] : ['a']),
    (id) => ({ slug: id }),
  );
  assert.deepEqual(paths, [
    { params: { lang: undefined, slug: 'a' }, props: { lang: 'en', item: 'a' } },
    { params: { lang: undefined, slug: 'b' }, props: { lang: 'en', item: 'b' } },
    { params: { lang: 'tr', slug: 'a' }, props: { lang: 'tr', item: 'a' } },
    { params: { lang: 'es', slug: 'a' }, props: { lang: 'es', item: 'a' } },
  ]);
});

test('navLinks: dile göre adres ve etiket; ana sayfa yalnız kendisinde güncel', async () => {
  const { navLinks } = await import('../src/lib/nav.ts');
  const tr = navLinks('/tr/writing/x/', 'tr');
  assert.deepEqual(
    tr.map((l) => [l.href, l.label, l.current]),
    [
      ['/tr/', 'Ana sayfa', false],
      ['/tr/photos/', 'Fotoğraflar', false],
      ['/tr/writing/', 'Yazılar', true],
      ['/tr/reading/', 'Kitaplar', false],
      ['/tr/playing/', 'Çaldıklarım', false],
      ['/tr/years/', 'Yıllar', false],
      ['/tr/about/', 'Hakkımda', false],
    ],
  );
  assert.equal(navLinks('/', 'en')[0].current, true);
  assert.equal(navLinks('/about/', 'en')[0].current, false);
});

test('profileLinks ve emailLink: site.ts bağlantılarından', async () => {
  const { profileLinks, emailLink } = await import('../src/lib/nav.ts');
  assert.deepEqual(
    profileLinks().map((l) => l.label),
    ['GitHub', 'LinkedIn', 'Medium'],
  );
  assert.deepEqual(emailLink(), { href: 'mailto:ahmet@yakar.me', address: 'ahmet@yakar.me' });
});
