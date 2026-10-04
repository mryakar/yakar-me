const DAY_MS = 24 * 60 * 60 * 1000;

export function parseHeadersFile(text) {
  const rules = [];
  for (const line of text.split('\n')) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    if (!/^\s/.test(line)) {
      rules.push({ pattern: line.trim(), headers: [] });
      continue;
    }
    const colon = line.indexOf(':');
    if (!rules.length || colon < 0) throw new Error(`_headers: unexpected line "${line.trim()}"`);
    rules.at(-1).headers.push([line.slice(0, colon).trim().toLowerCase(), line.slice(colon + 1).trim()]);
  }
  return rules;
}

export const matchesPattern = (pattern, path) =>
  pattern.endsWith('*') ? path.startsWith(pattern.slice(0, -1)) : pattern === path;

export function headerProblems(rules, path, got) {
  return rules
    .filter((r) => matchesPattern(r.pattern, path))
    .flatMap((r) => r.headers)
    .filter(([name, value]) => got.get(name) !== value)
    .map(([name, value]) => `${path}: ${name} is ${JSON.stringify(got.get(name))}, _headers says ${JSON.stringify(value)}`);
}

const sameSet = (a, b) => a.length === b.length && [...a].sort().join('\n') === [...b].sort().join('\n');

export function emailDnsProblems(resolver, seen, expected) {
  const problems = [];
  const at = (what, got, want) => problems.push(`${resolver}: ${what} is ${JSON.stringify(got)}, expected ${JSON.stringify(want)}`);
  const mx = seen.mx.map((m) => `${m.priority} ${m.exchange}`);
  if (!sameSet(mx, expected.mx)) at('MX', mx, expected.mx);
  const root = seen.rootTxt.map((t) => t.join(''));
  const spf = root.filter((t) => t.startsWith('v=spf1'));
  if (spf.length !== 1 || spf[0] !== expected.spf) at('SPF', spf, expected.spf);
  for (const txt of expected.rootTxt) if (!root.includes(txt)) problems.push(`${resolver}: root TXT has no ${JSON.stringify(txt)}`);
  const dmarc = seen.dmarc.map((t) => t.join('')).filter((t) => t.startsWith('v=DMARC1'));
  if (dmarc.length !== 1 || dmarc[0] !== expected.dmarc) at('DMARC', dmarc, expected.dmarc);
  for (const [selector, target] of Object.entries(expected.dkim)) {
    const got = seen.dkim[selector] ?? [];
    if (got.length !== 1 || got[0] !== target) at(`DKIM ${selector} CNAME`, got, target);
  }
  return problems;
}

export function certificateProblems(cert, host, now, minDays) {
  const problems = [];
  const left = (new Date(cert.validTo).valueOf() - now.valueOf()) / DAY_MS;
  if (!(left >= minDays)) problems.push(`certificate expires ${cert.validTo} (${Math.floor(left)} days left, at least ${minDays} expected)`);
  const names = (cert.subjectAltName ?? '').split(',').map((s) => s.trim().replace(/^DNS:/, ''));
  if (!names.includes(host)) problems.push(`certificate does not name ${host}: ${cert.subjectAltName}`);
  return problems;
}

const BLOCKED = new Set([401, 403, 429, 999]);
const TRANSIENT_ERRORS = new Set(['TimeoutError', 'AbortError', 'ECONNRESET', 'ECONNREFUSED', 'EAI_AGAIN', 'ETIMEDOUT', 'UND_ERR_SOCKET']);

export function linkVerdict({ status, error }) {
  if (error) return TRANSIENT_ERRORS.has(error) ? 'retry' : 'broken';
  if (status < 400) return 'ok';
  if (BLOCKED.has(status)) return 'blocked';
  if (status >= 500) return 'retry';
  return 'broken';
}
