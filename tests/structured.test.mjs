import { test } from 'node:test';
import assert from 'node:assert/strict';
import { blogPosting, jsonLd, profile } from '../src/lib/structured.ts';

const author = { name: 'Ahmet Yakar', url: 'https://yakar.me' };
const post = {
  headline: 'Locks',
  description: 'D',
  published: new Date('2026-09-16T00:00:00Z'),
  lang: 'en',
  url: 'https://yakar.me/writing/locks/',
  image: 'https://yakar.me/og.png',
  author,
};

test('blogPosting: özgün yazıda translationOfWork yok', () => {
  const o = blogPosting(post);
  assert.equal(o['@type'], 'BlogPosting');
  assert.equal(o.datePublished, '2026-09-16');
  assert.deepEqual(o.author, { '@type': 'Person', name: 'Ahmet Yakar', url: 'https://yakar.me' });
  assert.equal('translationOfWork' in o, false);
});

test('blogPosting: çeviride translationOfWork özgüne', () => {
  const o = blogPosting({ ...post, lang: 'tr', url: 'https://yakar.me/tr/writing/locks/', original: { url: post.url, lang: 'en' } });
  assert.equal(o.inLanguage, 'tr');
  assert.deepEqual(o.translationOfWork, { '@type': 'BlogPosting', url: post.url, inLanguage: 'en' });
});

test('profile: Person, sameAs yalnız verilen adresler', () => {
  assert.deepEqual(profile(author, ['https://github.com/mryakar']), {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: 'Ahmet Yakar',
    url: 'https://yakar.me',
    sameAs: ['https://github.com/mryakar'],
  });
});
test('jsonLd: </script> ve HTML karakterleri kaçırılır, JSON geçerli kalır', () => {
  const data = { caption: '</script><script>alert(1)</script> & \u2028' };
  const out = jsonLd(data);
  assert.doesNotMatch(out, /[<>&\u2028]/);
  assert.deepEqual(JSON.parse(out), data);
});

