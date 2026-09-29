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
  const html = '<link rel="alternate" type="application/rss+xml" href="/rss.xml"><link rel="alternate" hreflang="tr" href="https://yakar.me/tr/"><link rel="canonical" href="https://yakar.me/">';
  assert.deepEqual(hreflangs(html), [['tr', 'https://yakar.me/tr/']]);
});

const alt = (path) =>
  `<link rel="alternate" hreflang="en" href="https://yakar.me${path}"><link rel="alternate" hreflang="tr" href="https://yakar.me/tr${path}"><link rel="alternate" hreflang="x-default" href="https://yakar.me${path}">`;
const pages = (entries) => new Map(entries);

test('bekleme listesindeki sayfanın karşılığı yokken geçer; --complete ile kırılır', () => {
  const site = pages([['/', alt('/')], ['/tr/', alt('/')], ['/writing/x/', '']]);
  assert.deepEqual(counterpartErrors(site, ['/writing/x/']), []);
  assert.match(counterpartErrors(site, ['/writing/x/'], { complete: true }).join('\n'), /1 translation\(s\) pending: \/writing\/x\//);
  assert.match(counterpartErrors(site, []).join('\n'), /\/writing\/x\/: no counterpart at \/tr\/writing\/x\//);
});

test('bekleme listesindeki sayfanın iki dili de varsa kırılır', () => {
  const site = pages([['/writing/x/', alt('/writing/x/')], ['/tr/writing/x/', alt('/writing/x/')]]);
  assert.match(counterpartErrors(site, ['/writing/x/']).join('\n'), /listed as pending but every language exists/);
});
