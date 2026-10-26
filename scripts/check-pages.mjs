import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { launchChrome, waitFor } from './lib/cdp.mjs';
import { a11yProblems, budgetProblems, kb, shiftProblems, shiftTotal, weigh } from './lib/page-checks.mjs';
import { sitemapUrls } from './lib/live-checks.mjs';
import { drain } from './lib/pool.mjs';
import { localize, locales } from '../src/lib/i18n.ts';

const PORT = 8788;
const BASE = `http://localhost:${PORT}`;
const TABS = 4;
const QUIET_MS = 1000;
const STALL_MS = 5000;
const PAGE_TIMEOUT_MS = 30000;
const NOT_FOUND = locales.map((lang) => localize('/__not-found__/', lang));
const SEARCHES = locales.map((lang) => localize('/search/?q=postgresql', lang));
const VIEWS = {
  phone: { width: 390, height: 844, deviceScaleFactor: 3, mobile: true },
  desktop: { width: 1440, height: 900, deviceScaleFactor: 2, mobile: false },
};
const THEMES = ['dark', 'light'];
const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'];

const RECORD_VIOLATIONS = `addEventListener('securitypolicyviolation', (e) => (window.__cspViolations ||= []).push(\`\${e.disposition} \${e.violatedDirective}: \${e.sample || e.blockedURI}\`));`;
const RECORD_SHIFTS = `window.__layoutShifts = [];
new PerformanceObserver((list) => {
  for (const e of list.getEntries()) {
    if (e.hadRecentInput) continue;
    const name = (n) => (n?.tagName ? n.tagName.toLowerCase() + (n.id ? '#' + n.id : '') + (n.className && typeof n.className === 'string' ? '.' + n.className.split(' ').slice(0, 2).join('.') : '') : '?');
    window.__layoutShifts.push({ value: e.value, time: Math.round(e.startTime), sources: (e.sources ?? []).map((s) => name(s.node)) });
  }
}).observe({ type: 'layout-shift', buffered: true });
window.__longTasks = [];
new PerformanceObserver((list) => {
  for (const e of list.getEntries()) window.__longTasks.push(Math.round(e.duration));
}).observe({ type: 'longtask', buffered: true });`;

const axe = readFileSync(new URL('../node_modules/axe-core/axe.min.js', import.meta.url), 'utf8');
const exceptions = JSON.parse(readFileSync(new URL('./a11y-exceptions.json', import.meta.url), 'utf8'));
const today = new Date().toISOString().slice(0, 10);

const runAxe = `(${async (tags, ex) => {
  const result = await globalThis.axe.run(document, {
    runOnly: { type: 'tag', values: tags },
    resultTypes: ['violations'],
  });
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
  const pages = sitemapUrls(await (await fetch(`${BASE}/sitemap.xml`)).text()).map((url) => new URL(url).pathname);
  const jobs = [...pages, ...SEARCHES, ...NOT_FOUND].flatMap((path) =>
    Object.keys(VIEWS).map((view) => ({ path, view })),
  );

  chrome = await launchChrome();
  const tabs = await Promise.all(Array.from({ length: TABS }, () => openTab(chrome)));
  const weights = [];
  const scans = [];
  const problems = [];
  await drain(jobs, tabs, async (job, tab) => {
    try {
      const result = await check(tab, job).catch(() => check(tab, job));
      weights.push(result.weight);
      scans.push(...result.scans);
      problems.push(...result.problems);
    } catch (e) {
      problems.push(`${job.path} (${job.view}): ${e.message}`);
    }
  });

  problems.push(...a11yProblems(scans, exceptions, today));
  const max = (key) => weights.reduce((a, b) => (b[key] > a[key] ? b : a));
  const tiles = weights.filter((w) => w.tiles > 0);
  console.log(
    `${problems.length ? '✗' : '✓'} ${weights.length} page views: heaviest ${kb(max('total').total)} KB (${max('total').where}), ` +
      `most requests ${max('requests').requests} (${max('requests').where}), site scripts ≤ ${kb(max('script').script)} KB, ` +
      `vendored ≤ ${kb(max('vendor').vendor)} KB${tiles.length ? `, map tiles on first view ≤ ${Math.max(...tiles.map((w) => w.tiles))}` : ''}`,
  );
  console.log(
    `${problems.length ? '✗' : '✓'} layout shift ≤ ${max('shift').shift.toFixed(3)} (${max('shift').where}), ` +
      `longest task ${max('longTask').longTask} ms (${max('longTask').where})`,
  );
  console.log(
    `${problems.length ? '✗' : '✓'} ${scans.length} accessibility scans (${AXE_TAGS.join(', ')}), ${exceptions.length} exception(s)`,
  );
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
  await tab.send('Page.addScriptToEvaluateOnNewDocument', { source: RECORD_VIOLATIONS });
  await tab.send('Page.addScriptToEvaluateOnNewDocument', { source: RECORD_SHIFTS });
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
  await waitFor(async () => settled(), { timeout: PAGE_TIMEOUT_MS, every: 100, what: `${where} to settle` }).catch(
    (e) => {
      throw new Error(`${e.message}; loaded: ${tab.loaded}; pending: ${pending().join(' ') || 'none'}`);
    },
  );

  const { result: hasMap } = await tab.send('Runtime.evaluate', {
    expression: "!!document.querySelector('[data-map]')",
    returnByValue: true,
  });
  if (hasMap.value) {
    await tab.send('Runtime.evaluate', {
      expression: "document.querySelector('[data-map]').dispatchEvent(new Event('pointerenter'))",
    });
    tab.last = Date.now();
    await waitFor(async () => settled(), { timeout: PAGE_TIMEOUT_MS, every: 100, what: `${where} map to settle` });
  }

  const problems = [];
  const expected = NOT_FOUND.includes(path) ? 404 : 200;
  if (tab.status !== expected) problems.push(`${where}: HTTP ${tab.status}, expected ${expected}`);
  const requests = [...tab.requests.values()];
  const weight = {
    where,
    ...weigh(requests),
    tiles: requests.filter((r) => new URL(r.url).pathname.startsWith('/tiles/')).length,
  };
  problems.push(...budgetProblems(where, weight));
  const { result: csp } = await tab.send('Runtime.evaluate', {
    expression: 'window.__cspViolations ?? []',
    returnByValue: true,
  });
  for (const v of csp.value) problems.push(`${where}: CSP violation (${v})`);
  const { result: longTasks } = await tab.send('Runtime.evaluate', {
    expression: 'window.__longTasks ?? []',
    returnByValue: true,
  });
  weight.longTask = Math.max(0, ...longTasks.value);

  await tab.send('Runtime.evaluate', { expression: axe });
  const scans = [];
  for (const theme of THEMES) {
    await tab.send('Emulation.setEmulatedMedia', { features: media(theme) });
    const { result, exceptionDetails } = await tab.send('Runtime.evaluate', {
      expression: runAxe,
      awaitPromise: true,
      returnByValue: true,
    });
    if (exceptionDetails) throw new Error(`axe: ${exceptionDetails.exception?.description ?? exceptionDetails.text}`);
    scans.push({ where: `${path} (${view}, ${theme})`, violations: result.value });
  }

  await tab.send('Network.setCacheDisabled', { cacheDisabled: false });
  Object.assign(tab, { last: Date.now(), loaded: false });
  await tab.send('Page.navigate', { url: `${BASE}${path}` });
  await waitFor(async () => tab.loaded && Date.now() - tab.last >= QUIET_MS, {
    timeout: PAGE_TIMEOUT_MS,
    every: 100,
    what: `${where} to settle from cache`,
  });
  const { result: shifts } = await tab.send('Runtime.evaluate', {
    expression: 'window.__layoutShifts ?? []',
    returnByValue: true,
  });
  await tab.send('Network.setCacheDisabled', { cacheDisabled: true });
  weight.shift = shiftTotal(shifts.value);
  problems.push(...shiftProblems(where, shifts.value));
  return { weight, scans, problems };
}
