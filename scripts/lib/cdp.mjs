import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function waitFor(check, { timeout, every = 250, what }) {
  const until = Date.now() + timeout;
  while (Date.now() < until) {
    if (await check().catch(() => false)) return;
    await sleep(every);
  }
  throw new Error(`timed out after ${timeout} ms waiting for ${what}`);
}

export async function launchChrome({ binary = process.env.CHROME_PATH || 'google-chrome', port = 9333 } = {}) {
  const profile = mkdtempSync(join(tmpdir(), 'chrome-'));
  const proc = spawn(
    binary,
    [
      '--headless=new',
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${profile}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--enable-unsafe-swiftshader',
      '--use-angle=swiftshader',
      'about:blank',
    ],
    { stdio: 'ignore' },
  );
  let url;
  await waitFor(
    async () => (url = (await (await fetch(`http://127.0.0.1:${port}/json/version`)).json()).webSocketDebuggerUrl),
    { timeout: 20000, what: `${binary} on port ${port}` },
  );
  const ws = new WebSocket(url);
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', reject, { once: true });
  });
  let id = 0;
  const pending = new Map();
  const listeners = new Set();
  ws.addEventListener('message', ({ data }) => {
    const msg = JSON.parse(data);
    if (msg.id !== undefined) {
      const p = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) p?.reject(new Error(`${p.method}: ${msg.error.message}`));
      else p?.resolve(msg.result);
    } else for (const l of listeners) l(msg);
  });
  const send = (method, params = {}, sessionId) =>
    new Promise((resolve, reject) => {
      const i = ++id;
      pending.set(i, { resolve, reject, method });
      ws.send(JSON.stringify({ id: i, method, params, ...(sessionId ? { sessionId } : {}) }));
    });
  const close = () => {
    ws.close();
    proc.kill();
    rmSync(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  };
  return { send, on: (l) => listeners.add(l), off: (l) => listeners.delete(l), close };
}
