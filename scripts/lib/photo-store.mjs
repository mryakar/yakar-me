import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

export const CONTENT_DIR = 'src/content/photos';
export const PUBLIC_DIR = 'public/img';
export const BUCKET = 'yakarme-photos';

export const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

export function records(root = '.') {
  const dir = join(root, CONTENT_DIR);
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .flatMap((d) =>
      readdirSync(join(dir, d.name))
        .filter((f) => f.endsWith('.json'))
        .map((f) => ({ series: d.name, id: f.replace(/\.json$/, ''), data: JSON.parse(readFileSync(join(dir, d.name, f), 'utf8')) })),
    );
}

export function variantIndex(root = '.') {
  const index = new Map();
  for (const r of records(root)) {
    for (const v of [...r.data.variants.avif, ...r.data.variants.webp]) index.set(v.file, v);
  }
  return index;
}
