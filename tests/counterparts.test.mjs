import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pagePath, hreflangs } from '../scripts/lib/counterparts.mjs';

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
