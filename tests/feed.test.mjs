import { test } from 'node:test';
import assert from 'node:assert/strict';
import { absoluteUrls, newestFirst, rssFeed, rssItem } from '../src/lib/feed.ts';
import { xmlErrors } from '../scripts/lib/xml.mjs';

const page = 'https://yakar.me/writing/locks/';
const item = (over = {}) => ({
  title: 'Locks & <keys>',
  url: page,
  description: 'Rows, "tables" and ]]> markers',
  content: '<p>a &amp; b</p><pre><code>if (a < b) {}</code></pre>',
  category: 'Databases',
  date: new Date('2026-09-16T00:00:00Z'),
  ...over,
});
const channel = { title: 'Ahmet Yakar', url: 'https://yakar.me/', self: 'https://yakar.me/rss.xml', description: 'D', language: 'en' };

test('absoluteUrls: kök ve parça adresleri mutlak olur, dış adres ve şema dokunulmaz', () => {
  const html = '<a href="/photos/">p</a><a href="#intro">i</a><a href="https://example.com/x">x</a><a href="mailto:a@b.c">m</a><img src="/_astro/a.webp">';
  assert.equal(
    absoluteUrls(html, page),
    '<a href="https://yakar.me/photos/">p</a><a href="https://yakar.me/writing/locks/#intro">i</a><a href="https://example.com/x">x</a><a href="mailto:a@b.c">m</a><img src="https://yakar.me/_astro/a.webp">',
  );
});

test('absoluteUrls: srcset adayları tek tek, tanımlayıcılarıyla', () => {
  assert.equal(
    absoluteUrls('<img srcset="/img/a-640.webp 640w, /img/a-1280.webp 1280w">', page),
    '<img srcset="https://yakar.me/img/a-640.webp 640w, https://yakar.me/img/a-1280.webp 1280w">',
  );
});

test('rssItem: başlık, açıklama ve HTML gövde kaçırılır; ]]> ham kalmaz', () => {
  const xml = rssItem(item());
  assert.match(xml, /<title>Locks &amp; &lt;keys&gt;<\/title>/);
  assert.match(xml, /<content:encoded>&lt;p&gt;a &amp;amp; b&lt;\/p&gt;/);
  assert.doesNotMatch(xml, /]]>/);
  assert.match(xml, /<pubDate>Wed, 16 Sep 2026 00:00:00 GMT<\/pubDate>/);
  assert.doesNotMatch(xml, /enclosure/);
});

test('rssItem: görsel enclosure olarak, boyutuyla', () => {
  const xml = rssItem(item({ image: { url: 'https://yakar.me/img/a.webp', type: 'image/webp', bytes: 1234 } }));
  assert.match(xml, /<enclosure url="https:\/\/yakar.me\/img\/a.webp" length="1234" type="image\/webp" \/>/);
});

test('newestFirst: yeniden eskiye; aynı günde ilk sıra korunur', () => {
  const a = item({ title: 'a', date: new Date('2026-10-01') });
  const b = item({ title: 'b', date: new Date('2026-10-01') });
  const c = item({ title: 'c', date: new Date('2026-09-16') });
  const d = item({ title: 'd', date: new Date('2026-10-02') });
  assert.deepEqual(newestFirst([c, a, b, d]).map((i) => i.title), ['d', 'a', 'b', 'c']);
});

test('rssFeed: iyi biçimli XML, content ad alanı tanımlı', () => {
  const xml = rssFeed(channel, [item(), item({ title: '"quoted" \'apos\'' })]);
  assert.deepEqual(xmlErrors(xml), []);
  assert.match(xml, /xmlns:content="http:\/\/purl.org\/rss\/1.0\/modules\/content\/"/);
  assert.equal(xml.match(/<item>/g).length, 2);
});
