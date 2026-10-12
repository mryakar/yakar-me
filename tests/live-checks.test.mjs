import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { caaProblems, caaRecord, certificateProblems, emailDnsProblems, headerProblems, linkVerdict, matchesPattern, parseHeadersFile } from '../scripts/lib/live-checks.mjs';
import { inlineCodeProblems, isExternal, loadedUrls } from '../scripts/lib/html-rules.mjs';

const headersFile = `/*
  X-Frame-Options: DENY
  Strict-Transport-Security: max-age=604800

/_astro/*
  Cache-Control: public, max-age=31536000, immutable
`;

test('parseHeadersFile: kurallar, adlar küçük harf; repodaki _headers ayrışır', () => {
  assert.deepEqual(parseHeadersFile(headersFile), [
    { pattern: '/*', headers: [['x-frame-options', 'DENY'], ['strict-transport-security', 'max-age=604800']] },
    { pattern: '/_astro/*', headers: [['cache-control', 'public, max-age=31536000, immutable']] },
  ]);
  const repo = parseHeadersFile(readFileSync(new URL('../public/_headers', import.meta.url), 'utf8'));
  assert.ok(repo.some((r) => r.pattern === '/*' && r.headers.some(([n]) => n === 'content-security-policy')));
});

test('matchesPattern: sondaki * önek, yoksa birebir', () => {
  assert.equal(matchesPattern('/_astro/*', '/_astro/a.css'), true);
  assert.equal(matchesPattern('/_astro/*', '/img/a.webp'), false);
  assert.equal(matchesPattern('/*', '/'), true);
  assert.equal(matchesPattern('/robots.txt', '/robots.txt'), true);
});

test('headerProblems: eksik ya da farklı başlık yazılır, eşleşmeyen kural yok sayılır', () => {
  const rules = parseHeadersFile(headersFile);
  const ok = new Headers({ 'x-frame-options': 'DENY', 'strict-transport-security': 'max-age=604800' });
  assert.deepEqual(headerProblems(rules, '/', ok), []);
  const bad = new Headers({ 'x-frame-options': 'SAMEORIGIN' });
  const p = headerProblems(rules, '/', bad);
  assert.equal(p.length, 2);
  assert.match(p[0], /x-frame-options is "SAMEORIGIN", _headers says "DENY"/);
  assert.match(p[1], /strict-transport-security is null/);
});

const expected = {
  mx: ['10 mx01.mail.icloud.com', '10 mx02.mail.icloud.com'],
  spf: 'v=spf1 include:icloud.com ~all',
  rootTxt: ['apple-domain=X'],
  dmarc: 'v=DMARC1; p=quarantine',
  dkim: { sig1: 'sig1.dkim.example.at.icloudmailadmin.com' },
};
const seen = {
  mx: [{ exchange: 'mx02.mail.icloud.com', priority: 10 }, { exchange: 'mx01.mail.icloud.com', priority: 10 }],
  rootTxt: [['google-site-verification=abc'], ['v=spf1 include:icloud.com ', '~all'], ['apple-domain=X']],
  dmarc: [['v=DMARC1; p=quarantine']],
  dkim: { sig1: ['sig1.dkim.example.at.icloudmailadmin.com'] },
};

test('emailDnsProblems: sıra ve parçalı TXT önemsiz, ilgisiz TXT serbest', () => {
  assert.deepEqual(emailDnsProblems('1.1.1.1', seen, expected), []);
});

test('emailDnsProblems: MX, SPF, DMARC, DKIM ve doğrulama kaydı sapması', () => {
  const p = emailDnsProblems('8.8.8.8', {
    mx: [{ exchange: 'mx01.mail.icloud.com', priority: 10 }],
    rootTxt: [['v=spf1 -all'], ['v=spf1 include:icloud.com ~all']],
    dmarc: [],
    dkim: {},
  }, expected).join('\n');
  assert.match(p, /8\.8\.8\.8: MX/);
  assert.match(p, /SPF is \["v=spf1 -all","v=spf1 include:icloud.com ~all"\]/);
  assert.match(p, /root TXT has no "apple-domain=X"/);
  assert.match(p, /DMARC is \[\]/);
  assert.match(p, /DKIM sig1 CNAME is \[\]/);
});

test('certificateProblems: kalan gün ve alan adı', () => {
  const now = new Date('2026-10-04T00:00:00Z');
  const cert = { validTo: 'Dec 27 21:31:56 2026 GMT', subjectAltName: 'DNS:yakar.me, DNS:*.yakar.me' };
  assert.deepEqual(certificateProblems(cert, 'yakar.me', now, 14), []);
  assert.match(certificateProblems({ ...cert, validTo: 'Oct 10 00:00:00 2026 GMT' }, 'yakar.me', now, 14).join(), /6 days left/);
  assert.match(certificateProblems({ ...cert, subjectAltName: 'DNS:example.com' }, 'yakar.me', now, 14).join(), /does not name yakar.me/);
});

test('linkVerdict: kırık, engelli, yeniden dene', () => {
  assert.equal(linkVerdict({ status: 200 }), 'ok');
  assert.equal(linkVerdict({ status: 301 }), 'ok');
  assert.equal(linkVerdict({ status: 404 }), 'broken');
  assert.equal(linkVerdict({ status: 410 }), 'broken');
  for (const s of [401, 403, 429, 999]) assert.equal(linkVerdict({ status: s }), 'blocked');
  assert.equal(linkVerdict({ status: 503 }), 'retry');
  assert.equal(linkVerdict({ error: 'TimeoutError' }), 'retry');
  assert.equal(linkVerdict({ error: 'ENOTFOUND' }), 'broken');
  assert.equal(linkVerdict({ error: 'CERT_HAS_EXPIRED' }), 'broken');
});

test('html-rules: dış kaynak ve satır içi script; Cloudflare beacon yakalanır', () => {
  const html = '<script src="/theme.js"></script><script defer src="https://static.cloudflareinsights.com/beacon.min.js"></script><script>x()</script>';
  assert.deepEqual(loadedUrls(html).filter(isExternal), ['https://static.cloudflareinsights.com/beacon.min.js']);
  assert.match(inlineCodeProblems(html).join(), /inline script/);
});

test('caaRecord ve caaProblems: küme olarak; silinen, eklenen ve değişen kayıt kırar', () => {
  assert.equal(caaRecord({ critical: 0, type: 'CAA', issue: 'pki.goog; cansignhttpexchanges=yes' }), '0 issue "pki.goog; cansignhttpexchanges=yes"');
  assert.equal(caaRecord({ critical: 128, issuewild: 'letsencrypt.org' }), '128 issuewild "letsencrypt.org"');
  const want = ['0 issue "letsencrypt.org"', '0 issuewild "letsencrypt.org"'];
  const live = [{ critical: 0, type: 'CAA', issuewild: 'letsencrypt.org' }, { critical: 0, type: 'CAA', issue: 'letsencrypt.org' }];
  assert.deepEqual(caaProblems('1.1.1.1', live, want), []);
  assert.match(caaProblems('1.1.1.1', [], want)[0], /^1\.1\.1\.1: CAA is \[\], expected/);
  assert.equal(caaProblems('8.8.8.8', [...live, { critical: 0, type: 'CAA', issue: 'evil.example' }], want).length, 1);
  assert.equal(caaProblems('8.8.8.8', [live[0], { critical: 0, type: 'CAA', issue: 'ssl.com' }], want).length, 1);
});

test('live-expected.json: CAA kayıtları biçimli, Universal SSL kuruluşları issue ve issuewild için var', () => {
  const { caa } = JSON.parse(readFileSync(new URL('../scripts/live-expected.json', import.meta.url), 'utf8'));
  for (const r of caa) assert.match(r, /^0 (issue|issuewild) "[^"]+"$/);
  for (const ca of ['letsencrypt.org', 'pki.goog', 'ssl.com']) {
    for (const tag of ['issue', 'issuewild']) assert.ok(caa.some((r) => r.startsWith(`0 ${tag} "${ca}`)), `${tag} ${ca}`);
  }
});
