import { parseArgs } from 'node:util';
import { execFileSync } from 'node:child_process';
import { createInterface } from 'node:readline';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, extname, join, resolve } from 'node:path';
import { homedir, tmpdir } from 'node:os';
import { inspectImage } from './lib/image-meta.mjs';
import { decode, encode, targetWidths, FORMATS } from './lib/variants.mjs';
import { credentials, put } from './lib/r2.mjs';
import { CONTENT_DIR, PUBLIC_DIR, records, sha256 } from './lib/photo-store.mjs';
import {
  EXIFTOOL_TAGS, FILM_SIMULATION_NAMES, PhotoError, cameraFrame, hasRecipe, location, parsePlace, photoId, readRecipe, readShot,
} from './lib/photo-record.mjs';
import { aperture, focalLength, placeName, recipeRows, shutter, takenYear } from '../src/lib/photo.ts';

const TOKEN_FILE = join(homedir(), '.config', 'yakar-me', 'r2-write.env');
const USAGE = `Usage: npm run photo:add -- --series <slug> <photo> [--camera-dir <dir>]... [--alt "<text>"] [--place "<district>, <city>, <country>"] [--no-upload]`;

const { values: opts, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    series: { type: 'string' },
    'camera-dir': { type: 'string', multiple: true, default: [] },
    alt: { type: 'string' },
    place: { type: 'string' },
    'no-upload': { type: 'boolean', default: false },
  },
});

const rl = createInterface({ input: process.stdin });
const lines = [];
const waiting = [];
let ended = false;
rl.on('line', (l) => (waiting.length ? waiting.shift()(l) : lines.push(l)));
rl.on('close', () => {
  ended = true;
  while (waiting.length) waiting.shift()(null);
});
const fail = (msg) => {
  console.error(`✗ ${msg}`);
  rl.close();
  process.exit(1);
};
const ask = async (q) => {
  process.stdout.write(q);
  const l = lines.length ? lines.shift() : ended ? null : await new Promise((r) => waiting.push(r));
  if (l === null) fail('no answer (input closed)');
  return l.trim();
};

if (positionals.length !== 1 || !opts.series) fail(USAGE);
const series = opts.series;
if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(series)) fail(`series: expected a slug like hong-kong, got ${series}`);
if (!existsSync(join(CONTENT_DIR, series, 'index.md'))) fail(`series ${series} does not exist: create ${CONTENT_DIR}/${series}/index.md first`);

const input = resolve(positionals[0]);
if (!existsSync(input)) fail(`${input} not found`);
const id = photoId(input);
if (!id) fail(`cannot derive an id from ${basename(input)}`);
const clash = records().find((r) => r.id === id && r.series !== series);
if (clash) fail(`${id} already exists in series ${clash.series}`);
const replacing = records().some((r) => r.id === id && r.series === series);

const exiftool = (file, extra = []) => {
  try {
    return JSON.parse(execFileSync('exiftool', ['-j', ...extra, file], { maxBuffer: 64 << 20 }))[0];
  } catch (e) {
    fail(`exiftool could not read ${file}: ${e.message}`);
  }
};
const readTags = (file) => exiftool(file, ['-n', ...EXIFTOOL_TAGS.map((t) => `-${t}`)]);

const work = mkdtempSync(join(tmpdir(), 'photo-add-'));
process.on('exit', () => rmSync(work, { recursive: true, force: true }));

let pixels = input;
if (/^\.(heic|heif)$/i.test(extname(input))) {
  pixels = join(work, `${id}.png`);
  try {
    execFileSync('magick', [input, '-define', 'png:exclude-chunks=exif', pixels], { stdio: 'pipe' });
  } catch (e) {
    fail(`HEIC conversion failed (ImageMagick with libheif): ${e.stderr?.toString().trim() || e.message}`);
  }
}

let shot;
let tags;
try {
  tags = readTags(input);
  shot = readShot(tags);
} catch (e) {
  if (e instanceof PhotoError) fail(e.message);
  throw e;
}

const gps = location(tags);
console.log(`Coordinates in the file (not published): ${gps ? `${gps.lat}, ${gps.lon}` : 'none'}`);
try {
  shot.place = parsePlace(opts.place ?? (await ask('Place — district, city, country (e.g. Mong Kok, Hong Kong, Hong Kong): ')));
} catch (e) {
  if (e instanceof PhotoError) fail(e.message);
  throw e;
}

let recipeSource;
if (shot.kind === 'fujifilm') {
  const candidates = [];
  if (hasRecipe(tags)) candidates.push(input);
  const frame = cameraFrame(input);
  if (frame) {
    for (const dir of [dirname(input), ...opts['camera-dir'].map((d) => resolve(d))]) {
      for (const name of [`${frame}.JPG`, `${frame}.jpg`]) {
        const path = join(dir, name);
        if (existsSync(path) && path !== input && !candidates.includes(path)) candidates.push(path);
      }
    }
  }
  for (const path of candidates) {
    const camera = path === input ? tags : readTags(path);
    if (!hasRecipe(camera)) continue;
    if (camera.DateTimeOriginal !== tags.DateTimeOriginal) {
      console.warn(`! ${path}: taken ${camera.DateTimeOriginal}, not ${tags.DateTimeOriginal} — skipped`);
      continue;
    }
    try {
      shot.recipe = readRecipe(camera);
      recipeSource = path === input ? 'from the file' : `from the camera JPEG ${path}`;
      break;
    } catch (e) {
      if (e instanceof PhotoError) fail(`${path}: ${e.message}`);
      throw e;
    }
  }
  while (!shot.recipe) {
    const answer = await ask(
      `No film simulation for ${basename(input)} (Lightroom exports drop it). Path to the camera JPEG${frame ? ` ${frame}.JPG` : ''}, or Enter to choose the film simulation: `,
    );
    if (answer) {
      const path = resolve(answer.replace(/^~(?=\/)/, homedir()));
      if (!existsSync(path)) {
        console.warn(`! ${path} not found`);
        continue;
      }
      const camera = readTags(path);
      if (!hasRecipe(camera)) console.warn(`! ${path} has no Fujifilm recipe`);
      else if (camera.DateTimeOriginal !== tags.DateTimeOriginal) console.warn(`! ${path} was taken at ${camera.DateTimeOriginal}, not ${tags.DateTimeOriginal}`);
      else {
        shot.recipe = readRecipe(camera);
        recipeSource = `from the camera JPEG ${path}`;
      }
      continue;
    }
    FILM_SIMULATION_NAMES.forEach((name, i) => console.log(`  ${String(i + 1).padStart(2)}  ${name}`));
    const pick = FILM_SIMULATION_NAMES[Number(await ask('Film simulation number: ')) - 1];
    if (pick) {
      shot.recipe = { filmSimulation: pick };
      recipeSource = 'entered (film simulation only; the rest of the recipe is not shown)';
    }
  }
}

let alt = opts.alt ?? (await ask('Alt text — what the photo shows, for screen readers: '));
alt = alt.replace(/\s+/g, ' ').trim();
if (alt.length < 1 || alt.length > 250 || /[\u0000-\u001f\u007f]/.test(alt)) fail('alt text: 1–250 characters, no control characters');

const sourceTags = Object.keys(exiftool(input, ['-a', '-G1', '-e'])).filter((k) => !/^(SourceFile|System:|File:|ExifTool:)/.test(k));
const year = takenYear(shot.taken);
const line = (label, value) => console.log(`  ${label.padEnd(10)} ${value}`);
console.log(`\n${basename(input)} → ${series}/${id}${replacing ? '  (replaces the existing photo data)' : ''}`);
line('Camera', shot.kind === 'fujifilm' ? `${shot.make} ${shot.model} · ${shot.lens} · ${shot.recipe.filmSimulation}` : `${shot.make} ${shot.model}`);
line('Exposure', `${aperture(shot.aperture)}  ${shutter(shot.shutter)}  ISO ${shot.iso}  ${focalLength(shot)}`);
if (shot.recipe) {
  line('Recipe', recipeSource);
  for (const [label, value] of recipeRows(shot.recipe)) line('', `${label}: ${value}`);
}
line('Taken', shot.taken);
line('Place', `${placeName(shot.place)} — published on the page; coordinates are not`);
line('Alt', alt);
line('Rights', `© ${year} Ahmet Yakar — the only metadata in the served files (Artist, Copyright)`);
line('Dropped', `${sourceTags.length} metadata entries of the source (GPS, serial numbers, maker notes, XMP, thumbnails …)`);

console.log('\nEncoding variants …');
const decoded = await decode(pixels);
const widths = targetWidths(decoded.info.width, decoded.info.height);
const variants = { avif: [], webp: [] };
const files = [];
for (const format of Object.keys(FORMATS)) {
  for (const width of widths) {
    const { buffer, height } = await encode(decoded, width, format, year);
    const check = inspectImage(buffer);
    if (!check.ok) fail(`${format} ${width}px failed the metadata check: ${check.errors.join('; ')}`);
    const hash = sha256(buffer);
    const file = `${id}-${width}-${hash.slice(0, 8)}.${format}`;
    const path = join(work, file);
    writeFileSync(path, buffer);
    variants[format].push({ file, width, height, bytes: buffer.length, sha256: hash });
    files.push({ file, path, buffer });
    line(format, `${width}×${height}  ${Math.round(buffer.length / 1024)} KB`);
  }
}
const preview = files.find((f) => f.file.endsWith('.webp') && f.file.includes(`-${widths.at(-1)}-`)).path;
console.log(`\nPreview: ${preview}`);

const target = opts['no-upload'] ? 'public/img only (no upload)' : `R2 and public/img`;
if ((await ask(`Write ${files.length} files to ${target} and the photo data to ${CONTENT_DIR}/${series}/${id}.json? [y/N] `)).toLowerCase() !== 'y') {
  fail('cancelled — nothing written');
}

if (!opts['no-upload']) {
  if (!existsSync(TOKEN_FILE)) fail(`R2 write token not found: ${TOKEN_FILE}`);
  if (statSync(TOKEN_FILE).mode & 0o077) fail(`${TOKEN_FILE} must be readable only by you (chmod 600)`);
  let creds;
  try {
    creds = credentials(
      Object.fromEntries(
        readFileSync(TOKEN_FILE, 'utf8')
          .split('\n')
          .map((l) => /^\s*(R2_ACCOUNT_ID|R2_ACCESS_KEY_ID|R2_SECRET_ACCESS_KEY)\s*=\s*(\S+)\s*$/.exec(l))
          .filter(Boolean)
          .map((m) => [m[1], m[2]]),
      ),
    );
  } catch (e) {
    fail(`${TOKEN_FILE}: ${e.message}`);
  }
  if (!creds) fail(`${TOKEN_FILE} needs R2_ACCOUNT_ID, R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY`);
  for (const f of files) {
    try {
      await put(f.file, f.path, creds);
      console.log(`  ↑ ${f.file}`);
    } catch (e) {
      fail(`upload failed, photo data not written: ${e.message}`);
    }
  }
}

mkdirSync(PUBLIC_DIR, { recursive: true });
for (const f of files) writeFileSync(join(PUBLIC_DIR, f.file), f.buffer);
const { kind, make, model, lens, taken, aperture: f, shutter: t, iso, focalLength: mm, place, recipe } = shot;
const record = { alt, kind, make, model, lens, taken, aperture: f, shutter: t, iso, focalLength: mm, place, recipe, variants };
writeFileSync(join(CONTENT_DIR, series, `${id}.json`), `${JSON.stringify(record, null, 2)}\n`);
console.log(`✓ ${CONTENT_DIR}/${series}/${id}.json${opts['no-upload'] ? '  (not uploaded: CI will fail until the variants are in R2)' : ''}`);
rl.close();
