import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BASELINE, charsOf, ranges } from './lib/charset.mjs';
import { decodeEntities } from '../src/lib/search.ts';
import { FONT_FILES } from '../src/lib/fonts.ts';
import { fail } from './lib/cli.mjs';

const root = new URL('../', import.meta.url);
const dist = new URL('dist/', root);
const out = new URL('src/fonts/', root);
const python = process.env.FONTS_PYTHON ?? join(homedir(), '.cache', 'yakarme-fonts', 'bin', 'python');
if (!existsSync(fileURLToPath(dist))) fail('dist/ is missing — run npm run build first');
if (!existsSync(python))
  fail(`${python} is missing — python3 -m venv ~/.cache/yakarme-fonts && pip install fonttools brotli`);

const files = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? files(join(dir, e.name)) : [join(dir, e.name)],
  );
const chars = new Set(BASELINE);
for (const file of files(fileURLToPath(dist)).filter((f) => f.endsWith('.html') || f.endsWith('search.json')))
  for (const c of charsOf(decodeEntities(readFileSync(file, 'utf8')))) if (!/\s/.test(c)) chars.add(c);
const charset = { ranges: ranges(chars), count: chars.size };
mkdirSync(out, { recursive: true });
const charsetPath = new URL('charset.json', out);
writeFileSync(charsetPath, `${JSON.stringify(charset, null, 2)}\n`);
console.log(`charset: ${charset.count} characters in ${charset.ranges.length} ranges`);

for (const { source, file } of FONT_FILES) {
  const from = fileURLToPath(new URL(`node_modules/${source}`, root));
  const to = fileURLToPath(new URL(file, out));
  const info = JSON.parse(
    execFileSync(
      python,
      [fileURLToPath(new URL('lib/subset.py', import.meta.url)), from, to, fileURLToPath(charsetPath)],
      {
        encoding: 'utf8',
      },
    ),
  );
  const kb = (b) => (b / 1024).toFixed(1);
  console.log(
    `${file}: ${kb(statSync(from).size)} → ${kb(statSync(to).size)} KB (${info.kept} of ${info.inSource} code points, ${info.glyphs} glyphs)`,
  );
}
