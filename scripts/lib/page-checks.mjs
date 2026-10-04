const KB = 1024;

export const BUDGET = { total: 2000 * KB, requests: 30, script: 50 * KB, vendor: 1300 * KB };

export const kb = (bytes) => Math.round(bytes / KB);

export function weigh(all) {
  const byUrl = new Map();
  for (const r of all) if (!byUrl.has(r.url) || byUrl.get(r.url).bytes < r.bytes) byUrl.set(r.url, r);
  const requests = [...byUrl.values()];
  const sum = (list) => list.reduce((s, r) => s + r.bytes, 0);
  const scripts = requests.filter((r) => r.type === 'Script');
  const vendor = scripts.filter((r) => new URL(r.url).pathname.startsWith('/vendor/'));
  return {
    total: sum(requests),
    requests: requests.length,
    script: sum(scripts) - sum(vendor),
    vendor: sum(vendor),
  };
}

export function budgetProblems(where, weight, budget = BUDGET) {
  const over = [];
  if (weight.total > budget.total) over.push(`${kb(weight.total)} KB in total, budget ${kb(budget.total)} KB`);
  if (weight.requests > budget.requests) over.push(`${weight.requests} requests, budget ${budget.requests}`);
  if (weight.script > budget.script) over.push(`${kb(weight.script)} KB of site scripts, budget ${kb(budget.script)} KB`);
  if (weight.vendor > budget.vendor) over.push(`${kb(weight.vendor)} KB of vendored scripts, budget ${kb(budget.vendor)} KB`);
  return over.map((o) => `${where}: ${o}`);
}

export function a11yProblems(scans, exceptions, today) {
  const problems = [];
  const used = new Set();
  for (const { where, violations } of scans) {
    for (const v of violations) {
      for (const node of v.nodes) {
        if (node.excepted.length) node.excepted.forEach((s) => used.add(`${v.id} ${s}`));
        else problems.push(`${where}: ${v.id} (${v.impact}) ${node.target} — ${node.summary}`);
      }
    }
  }
  for (const e of exceptions) {
    if (!e.reason) problems.push(`exception ${e.rule} ${e.selector} has no reason`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(e.until ?? '')) problems.push(`exception ${e.rule} ${e.selector} has no until date`);
    else if (e.until < today) problems.push(`exception ${e.rule} ${e.selector} expired on ${e.until}`);
    if (!used.has(`${e.rule} ${e.selector}`)) problems.push(`exception ${e.rule} ${e.selector} no longer matches anything — remove it`);
  }
  return problems;
}
