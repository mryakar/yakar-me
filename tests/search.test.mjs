import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decodeEntities, fold, headings, plainText, prepare, queryTerms, search, snippet } from '../src/lib/search.ts';

const entry = (o) => ({ kind: 'writing', url: '/x/', title: '', detail: '', keywords: [], body: '', ...o });
const text = (segments) => segments.map((s) => (s.mark ? `[${s.text}]` : s.text)).join('');

test('fold: uzunluk korunur; İ/I/ı → i, işaretler düşer', () => {
  for (const s of ['İSTANBUL ılık', 'Şişli Göreme Üsküdar Çeşme', 'Nové Město', 'a𝔸b', 'ﬁ ß'])
    assert.equal(fold(s).length, s.length);
  assert.equal(fold('İSTANBUL ılık'), 'istanbul ilik');
  assert.equal(fold('Şişli Göreme Üsküdar Çeşme'), 'sisli goreme uskudar cesme');
  assert.equal(fold('Nové Město'), 'nove mesto');
});

test('decodeEntities ve plainText: etiketler düşer, varlıklar çözülür, geçersiz kod kalır', () => {
  assert.equal(
    decodeEntities('a &lt;b&gt; &amp; &#39;c&#x27; &nbsp;d &bogus; &#0; &#x110000;'),
    "a <b> & 'c'  d &bogus; &#0; &#x110000;",
  );
  assert.equal(
    plainText('<p>Hello <code>Map&lt;K, V&gt;</code></p>\n<script>x()</script><style>p{}</style><p>world</p>'),
    'Hello Map<K, V> world',
  );
  assert.equal(
    plainText('<p>Use <code>tryLock</code>, then <em>wait</em>.</p><ul><li>one</li><li>two</li></ul>'),
    'Use tryLock, then wait. one two',
  );
  assert.deepEqual(headings('<h2 id="a">One <em>two</em></h2><p>x</p><h3>Three</h3><h4>no</h4>'), ['One two', 'Three']);
});

test('queryTerms: katlanır, tekrar düşer, sınırlı', () => {
  assert.deepEqual(queryTerms('  Kilit, KİLİT  mvcc '), ['kilit', 'mvcc']);
  assert.deepEqual(queryTerms('<img src=x onerror=alert(1)>'), ['img', 'src', 'x', 'onerror', 'alert', '1']);
  assert.equal(queryTerms('a b c d e f g h i j').length, 8);
  assert.equal(queryTerms('x'.repeat(500))[0].length, 100);
  assert.deepEqual(queryTerms(' ,.; '), []);
});

test('search: bütün terimler geçmeli, kelime başından; başlık gövdeden önce', () => {
  const index = prepare([
    entry({ url: '/a/', title: 'Locks in Java', body: 'A deadlock happens when two threads wait.' }),
    entry({ url: '/b/', title: 'MVCC', body: 'PostgreSQL detects a deadlock and aborts one transaction.' }),
    entry({ url: '/c/', title: 'Deadlock', body: 'unrelated' }),
    entry({ url: '/d/', title: 'Padlocks', body: 'nothing here' }),
  ]);
  assert.deepEqual(
    search(index, 'deadlock').map((r) => r.entry.url),
    ['/c/', '/a/', '/b/'],
  );
  assert.deepEqual(
    search(index, 'dead postgres').map((r) => r.entry.url),
    ['/b/'],
  );
  assert.deepEqual(
    search(index, 'lock').map((r) => r.entry.url),
    ['/a/'],
  );
  assert.deepEqual(search(index, '   '), []);
});

test('search: Türkçe büyük/küçük harf ve işaretten bağımsız', () => {
  const index = prepare([entry({ url: '/t/', title: 'İstanbul', detail: 'Şişli, Türkiye', body: 'Işık ve gölge' })]);
  for (const q of ['istanbul', 'ISTANBUL', 'sisli', 'turkiye', 'isik', 'GÖLGE'])
    assert.equal(search(index, q).length, 1, q);
});

test('snippet: eşleşme işaretli, kelimede kesilir, uçlarda …', () => {
  const body = `${'word '.repeat(30)}the PostgreSQL deadlock detector ${'tail '.repeat(40)}`;
  const s = text(snippet(body, fold(body), ['deadlock', 'postgresql']));
  assert.match(s, /^… /);
  assert.match(s, /the \[PostgreSQL\] \[deadlock\] detector/);
  assert.match(s, / …$/);
  assert.ok(!/\bwor\b|\btai\b/.test(s));
  assert.equal(text(snippet('Short body with lock', fold('Short body with lock'), ['lock'])), 'Short body with [lock]');
  assert.deepEqual(snippet('no match', 'no match', ['zzz']), []);
});

test('search: gövdede yoksa alt satır işaretli, o da yoksa olduğu gibi', () => {
  const index = prepare([
    entry({ url: '/r/', kind: 'reading', title: 'Clean Code', detail: 'Robert C. Martin', keywords: ['Clean Code'] }),
  ]);
  assert.equal(text(search(index, 'martin')[0].snippet), 'Robert C. [Martin]');
  assert.equal(text(search(index, 'clean')[0].snippet), 'Robert C. Martin');
});
