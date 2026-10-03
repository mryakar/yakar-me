import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { auditProblems } from './lib/audit.mjs';

const run = () => {
  try {
    return execFileSync('npm', ['audit', '--json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] });
  } catch (e) {
    return e.stdout;
  }
};

const exceptions = JSON.parse(readFileSync(new URL('./audit-exceptions.json', import.meta.url), 'utf8'));
const today = new Date().toISOString().slice(0, 10);

let problems;
try {
  problems = auditProblems(JSON.parse(run()), exceptions, today);
} catch (e) {
  console.error(`✗ npm audit: ${e.message}`);
  process.exit(1);
}

if (problems.length) {
  for (const p of problems) console.error(`✗ ${p}`);
  process.exit(1);
}
console.log(`✓ npm audit: no advisories${exceptions.length ? ` beyond ${exceptions.map((e) => `${e.id} (until ${e.until})`).join(', ')}` : ''}`);
