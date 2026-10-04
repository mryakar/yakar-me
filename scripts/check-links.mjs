import { site } from '../src/site.ts';
import { linkVerdict } from './lib/live-checks.mjs';

const ORIGIN = site.url;
const USER_AGENT = `${site.domain} link check (+${ORIGIN})`;
const CONCURRENCY = 2;
const PAUSE_MS = 500;
const TIMEOUT_MS = 15000;
const RETRY_AFTER_MS = 60000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const decode = (href) => href.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'");

async function request(url, method) {
  try {
    const res = await fetch(url, {
      method,
      redirect: 'follow',
      headers: { 'user-agent': USER_AGENT, accept: 'text/html,*/*;q=0.8' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    await res.body?.cancel();
    return { status: res.status };
  } catch (e) {
    return { error: e.cause?.code ?? e.name };
  }
}

async function probe(url) {
  const head = await request(url, 'HEAD');
  const result = head.error || head.status >= 400 ? await request(url, 'GET') : head;
  return { ...result, verdict: linkVerdict(result) };
}

async function probeAll(urls) {
  const results = new Map();
  const queue = [...urls];
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      for (let url = queue.shift(); url; url = queue.shift()) {
        results.set(url, await probe(url));
        await sleep(PAUSE_MS);
      }
    }),
  );
  return results;
}

const sitemap = await (await fetch(`${ORIGIN}/sitemap.xml`)).text();
const pages = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
if (!pages.length) throw new Error('sitemap.xml lists no pages');
const foundOn = new Map();
for (const page of pages) {
  const html = await (await fetch(page)).text();
  for (const [, href] of html.matchAll(/<a\b[^>]*\shref="(https?:\/\/[^"]+)"/gi)) {
    const url = decode(href);
    if (url.startsWith(`${ORIGIN}/`)) continue;
    if (!foundOn.has(url)) foundOn.set(url, new URL(page).pathname);
  }
}

const results = await probeAll(foundOn.keys());
const again = [...results].filter(([, r]) => r.verdict === 'retry').map(([url]) => url);
if (again.length) {
  await sleep(RETRY_AFTER_MS);
  for (const [url, r] of await probeAll(again)) results.set(url, r.verdict === 'retry' ? { ...r, verdict: 'broken' } : r);
}

const by = (verdict) => [...results].filter(([, r]) => r.verdict === verdict);
const line = ([url, r]) => `${r.status ?? r.error} ${url} (on ${foundOn.get(url)})`;
const broken = by('broken');
const blocked = by('blocked');
console.log(`${broken.length ? '✗' : '✓'} ${results.size} outside links on ${pages.length} pages: ${by('ok').length} reachable, ${blocked.length} could not be checked, ${broken.length} broken`);
for (const b of blocked) console.log(`  · could not check: ${line(b)}`);
if (broken.length) {
  console.error(broken.map((b) => `✗ ${line(b)}`).join('\n'));
  process.exit(1);
}
