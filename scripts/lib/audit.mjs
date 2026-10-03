const GHSA = /GHSA-\w{4}-\w{4}-\w{4}$/;

export function advisories(report) {
  if (!report?.vulnerabilities) throw new Error(report?.error?.summary ?? 'npm audit returned no report');
  const found = new Map();
  for (const v of Object.values(report.vulnerabilities)) {
    for (const via of v.via) {
      if (typeof via === 'string') continue;
      const id = via.url?.match(GHSA)?.[0];
      if (!id) throw new Error(`${v.name}: advisory without a GHSA id (${via.url ?? via.title})`);
      found.set(id, { id, name: via.name, severity: via.severity, title: via.title });
    }
  }
  return [...found.values()];
}

export function auditProblems(report, exceptions, today) {
  const found = advisories(report);
  const excused = new Map(exceptions.map((e) => [e.id, e]));
  const problems = [];
  for (const a of found) {
    const e = excused.get(a.id);
    if (!e) problems.push(`${a.id} ${a.name} (${a.severity}): ${a.title}`);
    else if (e.until < today) problems.push(`${a.id} ${a.name}: exception expired on ${e.until}`);
  }
  for (const e of exceptions) {
    if (!found.some((a) => a.id === e.id)) problems.push(`${e.id}: exception no longer needed, remove it`);
  }
  return problems;
}
