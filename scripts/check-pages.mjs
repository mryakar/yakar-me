import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { launchChrome, waitFor } from './lib/cdp.mjs';
import { a11yProblems, budgetProblems, kb, weigh } from './lib/page-checks.mjs';

const PORT = 8788;
const BASE = `http://localhost:${PORT}`;
const TABS = 4;
const QUIET_MS = 1000;
const STALL_MS = 5000;
const PAGE_TIMEOUT_MS = 30000;
const NOT_FOUND = ['/__not-found__/', '/tr/__not-found__/'];
const VIEWS = {
  phone: { width: 390, height: 844, deviceScaleFactor: 3, mobile: true },
  desktop: { width: 1440, height: 900, deviceScaleFactor: 2, mobile: false },
};
const THEMES = ['dark', 'light'];
const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'];

const axe = readFileSync(new URL('../node_modules/axe-core/axe.min.js', import.meta.url), 'utf8');
const exceptions = JSON.parse(readFileSync(new URL('./a11y-exceptions.json', import.meta.url), 'utf8'));
const today = new Date().toISOString().slice(0, 10);

const runAxe = `(${async (tags, ex) => {
  const result = await globalThis.axe.run(document, { runOnly: { type: 'tag', values: tags }, resultTypes: ['violations'] });
  return result.violations.map((v) => ({
    id: v.id,
    impact: v.impact,
    nodes: v.nodes.map((n) => {
      const el = document.querySelector(n.target[0]);
      return {
        target: n.target.join(' '),
        summary: (n.failureSummary ?? '').replace(/\s+/g, ' ').trim(),
        excepted: ex.filter((e) => e.rule === v.id && el?.matches(e.selector)).map((e) => e.selector),
      };
    }),
  }));
}})(${JSON.stringify(AXE_TAGS)}, ${JSON.stringify(exceptions)})`;

const server = spawn('node_modules/.bin/wrangler', ['dev', '--port', String(PORT)], {
  stdio: 'ignore',
  detached: true,
  env: { ...process.env, WRANGLER_SEND_METRICS: 'false' },
});
let chrome;
process.on('exit', () => {
  chrome?.close();
  try {
    process.kill(-server.pid);
  } catch {}
});

{
  await waitFor(async () => (await fetch(`${BASE}/`)).ok, { timeout: 60000, what: `wrangler dev on ${BASE}` });
  const sitemap = await (await fetch(`${BASE}/sitemap.xml`)).text();
  const pages = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname);
  if (pages.length === 0) throw new Error('sitemap.xml lists no pages');
  const jobs = [...pages, ...NOT_FOUND].flatMap((path) => Object.keys(VIEWS).map((view) => ({ path, view })));

  chrome = await launchChrome();
  const tabs = await Promise.all(Array.from({ length: TABS }, () => openTab(chrome)));
  const weights = [];
  const scans = [];
  const problems = [];
  await Promise.all(
    tabs.map(async (tab) => {
      for (let job = jobs.shift(); job; job = jobs.shift()) {
        try {
          const result = await check(tab, job).catch(() => check(tab, job));
          weights.push(result.weight);
          scans.push(...result.scans);
          problems.push(...result.problems);
        } catch (e) {
          problems.push(`${job.path} (${job.view}): ${e.message}`);
        }
      }
    }),
  );

  problems.push(...a11yProblems(scans, exceptions, today));
  const max = (key) => weights.reduce((a, b) => (b[key] > a[key] ? b : a));
  const tiles = weights.filter((w) => w.tiles > 0);
  console.log(
    `${problems.length ? '✗' : '✓'} ${weights.length} page views: heaviest ${kb(max('total').total)} KB (${max('total').where}), ` +
      `most requests ${max('requests').requests} (${max('requests').where}), site scripts ≤ ${kb(max('script').script)} KB, ` +
      `vendored ≤ ${kb(max('vendor').vendor)} KB${tiles.length ? `, map tiles on first view ≤ ${Math.max(...tiles.map((w) => w.tiles))}` : ''}`,
  );
  console.log(`${problems.length ? '✗' : '✓'} ${scans.length} accessibility scans (${AXE_TAGS.join(', ')}), ${exceptions.length} exception(s)`);
  if (problems.length) {
    console.error(problems.map((p) => `✗ ${p}`).join('\n'));
  }
  process.exit(problems.length ? 1 : 0);
}

async function openTab(browser) {
  const { targetId } = await browser.send('Target.createTarget', { url: 'about:blank', newWindow: true });
  const { sessionId } = await browser.send('Target.attachToTarget', { targetId, flatten: true });
  const tab = { send: (method, params) => browser.send(method, params, sessionId), sessions: new Set([sessionId]) };
  const network = async (s) => {
    await browser.send('Network.enable', {}, s);
    await browser.send('Network.setCacheDisabled', { cacheDisabled: true }, s);
  };
  browser.on(async (msg) => {
    if (!tab.sessions.has(msg.sessionId)) return;
    const p = msg.params;
    switch (msg.method) {
      case 'Target.attachedToTarget':
        tab.sessions.add(p.sessionId);
        await network(p.sessionId).catch(() => {});
        await browser.send('Runtime.runIfWaitingForDebugger', {}, p.sessionId).catch(() => {});
        break;
      case 'Page.loadEventFired':
        tab.loaded = true;
        break;
      case 'Network.requestWillBeSent':
        tab.last = Date.now();
        if (p.request.url.startsWith('data:') || p.redirectResponse) break;
        tab.requests.set(p.requestId, { url: p.request.url, type: p.type, bytes: 0, done: false });
        break;
      case 'Network.responseReceived':
        if (p.type === 'Document' && !tab.status) tab.status = p.response.status;
        break;
      case 'Network.dataReceived':
        tab.last = Date.now();
        if (tab.requests.has(p.requestId)) tab.requests.get(p.requestId).bytes += p.dataLength;
        break;
      case 'Network.loadingFinished':
      case 'Network.loadingFailed':
        tab.last = Date.now();
        if (tab.requests.has(p.requestId)) tab.requests.get(p.requestId).done = true;
        break;
    }
  });
  await tab.send('Page.enable');
  await network(sessionId);
  await tab.send('Emulation.setFocusEmulationEnabled', { enabled: true });
  await tab.send('Target.setAutoAttach', { autoAttach: true, waitForDebuggerOnStart: true, flatten: true });
  return tab;
}

async function check(tab, { path, view }) {
  const where = `${path} (${view})`;
  const media = (theme) => [
    { name: 'prefers-color-scheme', value: theme },
    { name: 'prefers-reduced-motion', value: 'reduce' },
  ];
  await tab.send('Emulation.setDeviceMetricsOverride', VIEWS[view]);
  await tab.send('Emulation.setEmulatedMedia', { features: media(THEMES[0]) });
  Object.assign(tab, { requests: new Map(), last: Date.now(), loaded: false, status: 0 });
  await tab.send('Page.navigate', { url: `${BASE}${path}` });
  const pending = () => [...tab.requests.values()].filter((r) => !r.done).map((r) => r.url);
  const settled = () => {
    const quiet = Date.now() - tab.last;
    return tab.loaded && ((pending().length === 0 && quiet >= QUIET_MS) || quiet >= STALL_MS);
  };
  await waitFor(async () => settled(), { timeout: PAGE_TIMEOUT_MS, every: 100, what: `${where} to settle` }).catch((e) => {
    throw new Error(`${e.message}; loaded: ${tab.loaded}; pending: ${pending().join(' ') || 'none'}`);
  });

  const problems = [];
  const expected = NOT_FOUND.includes(path) ? 404 : 200;
  if (tab.status !== expected) problems.push(`${where}: HTTP ${tab.status}, expected ${expected}`);
  const requests = [...tab.requests.values()];
  const weight = { where, ...weigh(requests), tiles: requests.filter((r) => new URL(r.url).pathname.startsWith('/tiles/')).length };
  problems.push(...budgetProblems(where, weight));

  await tab.send('Runtime.evaluate', { expression: axe });
  const scans = [];
  for (const theme of THEMES) {
    await tab.send('Emulation.setEmulatedMedia', { features: media(theme) });
    const { result, exceptionDetails } = await tab.send('Runtime.evaluate', { expression: runAxe, awaitPromise: true, returnByValue: true });
    if (exceptionDetails) throw new Error(`axe: ${exceptionDetails.exception?.description ?? exceptionDetails.text}`);
    scans.push({ where: `${path} (${view}, ${theme})`, violations: result.value });
  }
  return { weight, scans, problems };
}
