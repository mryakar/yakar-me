import { Resolver } from 'node:dns/promises';
import { readFileSync } from 'node:fs';
import tls from 'node:tls';
import { site } from '../src/site.ts';
import { inlineCodeProblems, isExternal, loadedUrls } from './lib/html-rules.mjs';
import { certificateProblems, emailDnsProblems, headerProblems, matchesPattern, parseHeadersFile } from './lib/live-checks.mjs';
import { securityTxtErrors } from './lib/security-txt.mjs';

const ORIGIN = process.argv[2] ?? site.url;
const HOST = site.domain;
const BROWSER = {
  'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0 Safari/537.36',
  accept: 'text/html,application/xhtml+xml,*/*;q=0.8',
};
const RESOLVERS = ['1.1.1.1', '8.8.8.8'];
const NOT_FOUND = '/__not-found__/';
const CERT_MIN_DAYS = 14;
const SECURITY_TXT_NOTICE_DAYS = 30;
const RETRY_MS = 30000;
const TIMEOUT_MS = 20000;
const DAY_MS = 24 * 60 * 60 * 1000;

const expected = JSON.parse(readFileSync(new URL('./live-expected.json', import.meta.url), 'utf8'));
const rules = parseHeadersFile(readFileSync(new URL('../public/_headers', import.meta.url), 'utf8'));
const securityTxt = readFileSync(new URL('../public/.well-known/security.txt', import.meta.url), 'utf8');
const problems = [];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function once(what, call) {
  try {
    return await call();
  } catch {
    await sleep(RETRY_MS);
    try {
      return await call();
    } catch (e) {
      throw new Error(`${what}: ${e.cause?.code ?? e.code ?? e.message}`);
    }
  }
}
const get = (path, headers = BROWSER) =>
  once(path, () => fetch(`${ORIGIN}${path}`, { headers, redirect: 'manual', signal: AbortSignal.timeout(TIMEOUT_MS) }));

const liveUrls = new Set(expected.probes);

async function pages() {
  const sitemap = await (await get('/sitemap.xml')).text();
  const paths = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname);
  if (!paths.length) throw new Error('sitemap.xml lists no pages');
  for (const path of [...paths, NOT_FOUND]) {
    const res = await get(path);
    const want = path === NOT_FOUND ? 404 : 200;
    if (res.status !== want) problems.push(`${path}: HTTP ${res.status}, expected ${want}`);
    problems.push(...headerProblems(rules, path, res.headers));
    const html = await res.text();
    for (const p of inlineCodeProblems(html)) problems.push(`${path}: ${p}`);
    for (const url of loadedUrls(html)) {
      if (isExternal(url)) problems.push(`${path}: external or data: resource ${url}`);
      else if (url.startsWith('/')) liveUrls.add(url.split(/[?#]/)[0]);
    }
    for (const [, tiles] of html.matchAll(/\sdata-tiles="([^"{]+)/g)) liveUrls.add(`${tiles}0/0/0.mvt`);
  }
  return `${paths.length + 1} pages: status, headers, no inline code or outside resources (browser request)`;
}

async function assets() {
  for (const rule of rules.filter((r) => r.pattern !== '/*')) {
    const path = [...liveUrls].find((p) => matchesPattern(rule.pattern, p));
    if (!path) {
      problems.push(`_headers rule ${rule.pattern}: no live URL to check it with (add one to probes)`);
      continue;
    }
    const res = await get(path, { 'user-agent': BROWSER['user-agent'] });
    await res.body?.cancel();
    if (res.status !== 200) problems.push(`${path}: HTTP ${res.status}`);
    problems.push(...headerProblems(rules, path, res.headers));
  }
  return `${rules.length} _headers rules match the live responses`;
}

async function email() {
  for (const server of RESOLVERS) {
    const r = new Resolver({ timeout: 5000, tries: 2 });
    r.setServers([server]);
    const query = (what, call) =>
      once(`${server} ${what}`, () => call().catch((e) => (['ENODATA', 'ENOTFOUND'].includes(e.code) ? [] : Promise.reject(e))));
    const dkim = {};
    for (const selector of Object.keys(expected.email.dkim)) {
      dkim[selector] = await query(`${selector} DKIM`, () => r.resolveCname(`${selector}._domainkey.${HOST}`));
    }
    const seen = {
      mx: await query('MX', () => r.resolveMx(HOST)),
      rootTxt: await query('TXT', () => r.resolveTxt(HOST)),
      dmarc: await query('DMARC', () => r.resolveTxt(`_dmarc.${HOST}`)),
      dkim,
    };
    problems.push(...emailDnsProblems(server, seen, expected.email));
  }
  return `e-mail DNS (MX, SPF, DMARC, DKIM) as expected on ${RESOLVERS.join(' and ')}`;
}

async function certificate() {
  const cert = await once('TLS', () =>
    new Promise((resolve, reject) => {
      const socket = tls.connect({ host: HOST, port: 443, servername: HOST, timeout: TIMEOUT_MS }, () => {
        const c = socket.getPeerCertificate();
        socket.end();
        resolve({ validTo: c.valid_to, subjectAltName: c.subjectaltname });
      });
      socket.on('error', reject);
      socket.on('timeout', () => socket.destroy(new Error('timeout')));
    }),
  );
  problems.push(...certificateProblems(cert, HOST, new Date(), CERT_MIN_DAYS));
  return `certificate valid until ${cert.validTo}`;
}

async function securityContact() {
  const live = await (await get('/.well-known/security.txt', { 'user-agent': BROWSER['user-agent'] })).text();
  if (live !== securityTxt) problems.push('/.well-known/security.txt: the live file differs from the repository');
  const notice = new Date(Date.now() + SECURITY_TXT_NOTICE_DAYS * DAY_MS);
  for (const e of securityTxtErrors(live, notice)) problems.push(`/.well-known/security.txt in ${SECURITY_TXT_NOTICE_DAYS} days: ${e}`);
  return 'security.txt matches the repository and is not about to expire';
}

for (const [name, check] of [
  ['pages', pages],
  ['assets', assets],
  ['e-mail DNS', email],
  ['certificate', certificate],
  ['security.txt', securityContact],
]) {
  const before = problems.length;
  let summary = name;
  try {
    summary = await check();
  } catch (e) {
    problems.push(`${name}: ${e.message}`);
  }
  console.log(`${problems.length === before ? '✓' : '✗'} ${summary}`);
}

if (problems.length) {
  console.error(problems.map((p) => `✗ ${p}`).join('\n'));
  process.exit(1);
}
