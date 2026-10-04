import { test } from 'node:test';
import assert from 'node:assert/strict';
import { xmlErrors } from '../scripts/lib/xml.mjs';

const doc = (body) => `<?xml version="1.0" encoding="UTF-8"?>\n<rss a="1">${body}</rss>\n`;

test('xmlErrors: iyi biçimli belge', () => {
  assert.deepEqual(xmlErrors(doc('<x b="&amp;">t &lt; &#233; &#xE9;</x><y /><z></z>')), []);
});

test('xmlErrors: ham < ve tanımsız varlık', () => {
  assert.equal(xmlErrors(doc('a < b')).length > 0, true);
  assert.match(xmlErrors(doc('a &nbsp; b')).join(), /invalid text/);
  assert.match(xmlErrors(doc('<x b="a & b" />')).join(), /invalid attributes/);
  assert.match(xmlErrors(doc('<x b=1 />')).join(), /invalid attributes/);
});

test('xmlErrors: kapanmayan, yanlış kapanan ve fazla kök', () => {
  assert.match(xmlErrors(doc('<x>')).join(), /closes <x>|unclosed/);
  assert.match(xmlErrors(doc('<x></y>')).join(), /<\/y> closes <x>/);
  assert.match(xmlErrors('<a></a><b></b>').join(), /2 root elements/);
  assert.match(xmlErrors('<a></a>text').join(), /outside the root/);
});

test('xmlErrors: CDATA ve yorum desteklenmez (kapalı başarısız)', () => {
  assert.match(xmlErrors(doc('<![CDATA[x]]>')).join(), /unsupported/);
  assert.match(xmlErrors(doc('<!-- x -->')).join(), /unsupported/);
});
