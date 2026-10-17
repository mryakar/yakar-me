import { test } from 'node:test';
import assert from 'node:assert/strict';
import { counterpartErrors, pagePath, hreflangs } from '../scripts/lib/counterparts.mjs';

test('pagePath: dizin sayfaları; 404 ve diğer dosyalar dışarıda', () => {
  assert.equal(pagePath('index.html'), '/');
  assert.equal(pagePath('tr/index.html'), '/tr/');
  assert.equal(pagePath('tr/writing/x/index.html'), '/tr/writing/x/');
  assert.equal(pagePath('404.html'), null);
  assert.equal(pagePath('tr/404.html'), null);
  assert.equal(pagePath('google.html'), null);
});

test('hreflangs: yalnız rel="alternate" + hreflang; RSS alternate sayılmaz', () => {
  const html =
    '<link rel="alternate" type="application/rss+xml" href="/rss.xml"><link rel="alternate" hreflang="tr" href="https://yakar.me/tr/"><link rel="canonical" href="https://yakar.me/">';
  assert.deepEqual(hreflangs(html), [['tr', 'https://yakar.me/tr/']]);
});

const link = (lang, href) => `<link rel="alternate" hreflang="${lang}" href="https://yakar.me${href}">`;
const alt = (path, langs = ['en', 'tr', 'es']) =>
  [
    ...langs.map((l) => link(l, l === 'en' ? path : `/${l}${path}`)),
    ...(langs.includes('en') ? [link('x-default', path)] : []),
  ].join('');
const pages = (entries) => new Map(entries);
const none = { en: [], tr: [], es: [] };

test('üç dil de varsa hreflang seti tam (en, tr, es, x-default)', () => {
  const site = pages([
    ['/', alt('/')],
    ['/tr/', alt('/')],
    ['/es/', alt('/')],
  ]);
  assert.deepEqual(counterpartErrors(site, none), []);
  const short = pages([
    ['/', alt('/', ['en', 'tr'])],
    ['/tr/', alt('/')],
    ['/es/', alt('/')],
  ]);
  assert.match(
    counterpartErrors(short, none).join('\n'),
    /\/: hreflang set is \[en, tr, x-default\], expected \[en, tr, es, x-default\]/,
  );
});

test('bir dilde bekleyen sayfa: öbür dillerde hreflang yalnız var olanlar; --complete ile kırılır', () => {
  const site = pages([
    ['/writing/x/', alt('/writing/x/', ['en', 'tr'])],
    ['/tr/writing/x/', alt('/writing/x/', ['en', 'tr'])],
  ]);
  const waiting = { ...none, es: ['/writing/x/'] };
  assert.deepEqual(counterpartErrors(site, waiting), []);
  assert.match(
    counterpartErrors(site, waiting, { complete: true }).join('\n'),
    /1 translation\(s\) pending: \/es\/writing\/x\//,
  );
  assert.match(counterpartErrors(site, none).join('\n'), /\/writing\/x\/: no counterpart at \/es\/writing\/x\//);
});

test('tek dilde kalan sayfa hreflang taşımaz', () => {
  const site = pages([['/writing/x/', '']]);
  assert.deepEqual(counterpartErrors(site, { en: [], tr: ['/writing/x/'], es: ['/writing/x/'] }), []);
  assert.match(
    counterpartErrors(pages([['/writing/x/', alt('/writing/x/', ['en'])]]), {
      en: [],
      tr: ['/writing/x/'],
      es: ['/writing/x/'],
    }).join('\n'),
    /expected \[\]/,
  );
});

test('bekleme listesindeki sayfa o dilde varsa kırılır', () => {
  const site = pages([
    ['/writing/x/', alt('/writing/x/')],
    ['/tr/writing/x/', alt('/writing/x/')],
    ['/es/writing/x/', alt('/writing/x/')],
  ]);
  assert.match(
    counterpartErrors(site, { ...none, es: ['/writing/x/'] }).join('\n'),
    /listed as pending in es but \/es\/writing\/x\/ exists/,
  );
});
