import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { securityTxtErrors } from '../scripts/lib/security-txt.mjs';

const now = new Date('2026-10-04T00:00:00Z');
const txt = (expires) => `Contact: mailto:a@example.com\nExpires: ${expires}\nPreferred-Languages: en, tr\n`;

test('security.txt: bir yıldan kısa, gelecekteki Expires geçer', () => {
  assert.deepEqual(securityTxtErrors(txt('2027-10-01T00:00:00Z'), now), []);
  assert.deepEqual(securityTxtErrors(txt('2027-01-01T00:00:00+03:00'), now), []);
});

test('security.txt: geçmiş, bir yıldan uzak ya da RFC 3339 olmayan tarih kırar', () => {
  assert.match(securityTxtErrors(txt('2026-10-03T00:00:00Z'), now).join(), /has passed/);
  assert.match(securityTxtErrors(txt('2027-10-05T00:00:00Z'), now).join(), /more than a year/);
  assert.match(securityTxtErrors(txt('2027-01-01'), now).join(), /RFC 3339/);
});

test('security.txt: Contact yoksa, Expires iki kezse ya da satır bozuksa kırar', () => {
  assert.match(securityTxtErrors('Expires: 2027-01-01T00:00:00Z\n', now).join(), /no Contact/);
  assert.match(securityTxtErrors(txt('2027-01-01T00:00:00Z') + 'Expires: 2027-02-01T00:00:00Z\n', now).join(), /2 Expires/);
  assert.match(securityTxtErrors(txt('2027-01-01T00:00:00Z') + 'garbage\n', now).join(), /malformed/);
});

test('public/.well-known/security.txt bugün geçerli', () => {
  assert.deepEqual(securityTxtErrors(readFileSync(new URL('../public/.well-known/security.txt', import.meta.url), 'utf8')), []);
});
