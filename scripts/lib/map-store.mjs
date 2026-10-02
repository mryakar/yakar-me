import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { records } from './photo-store.mjs';
import { centreLookup, tileRoot } from '../../src/lib/map.ts';

export const MANIFEST = 'src/content/map.json';
export const DISTRICTS = 'src/content/districts.json';
export const PUBLIC_DIR = 'public';
export const TILES_DIR = 'public/tiles';
export const CACHE_DIR = '.cache/map';
export const WORLD_MAX_ZOOM = 6;
export const CITY_ZOOMS = [7, 13];

export const tileDir = (manifest) => join(PUBLIC_DIR, ...tileRoot(manifest.sha256).split('/'));

export function manifest(root = '.') {
  const path = join(root, MANIFEST);
  return existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : null;
}

export function photographedDistricts(root = '.') {
  const centreOf = centreLookup(JSON.parse(readFileSync(join(root, DISTRICTS), 'utf8')));
  return [...new Set(records(root).map((r) => centreOf(r.data.place)))];
}
