import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { launchChrome } from './lib/cdp.mjs';
import { frontmatter } from './lib/frontmatter.mjs';
import { pngChunks } from './lib/png.mjs';
import {
  articleCard,
  homeCard,
  ogCardHtml,
  ogImagePathFor,
  ogSections,
  sectionCard,
  seriesCard,
  OG_COVER_WIDTH,
  OG_DIR,
  OG_SIZE,
} from '../src/lib/og.ts';
import { smallestAtLeast } from '../src/lib/photo.ts';
import { locales } from '../src/lib/i18n.ts';

const root = new URL('../', import.meta.url);
const writing = new URL('src/content/writing/', root);
const photos = new URL('src/content/photos/', root);
const out = new URL(`public${OG_DIR}`, root);
const asset = (path) =>
  path.startsWith('/img/') ? new URL(`public${path}`, root).href : new URL(`node_modules/${path}`, root).href;
const translationsIn = (dir) => readdirSync(dir).filter((f) => /^[a-z]{2}\.md$/.test(f));
const focusOf = (value) => {
  const m = /x:\s*(\d+)\s*,\s*y:\s*(\d+)/.exec(value ?? '');
  return m ? { x: Number(m[1]), y: Number(m[2]) } : undefined;
};

const cards = locales.map(homeCard);
for (const slug of readdirSync(writing)) {
  const original = frontmatter(readFileSync(new URL(`${slug}/index.md`, writing), 'utf8'));
  const base = { id: slug, topic: original.topic, pubDate: new Date(original.pubDate) };
  cards.push(articleCard({ ...base, title: original.title }, original.lang));
  for (const file of translationsIn(new URL(`${slug}/`, writing))) {
    const t = frontmatter(readFileSync(new URL(`${slug}/${file}`, writing), 'utf8'));
    cards.push(articleCard({ ...base, title: t.title }, file.slice(0, 2)));
  }
}
for (const id of readdirSync(photos)) {
  const dir = new URL(`${id}/`, photos);
  const original = frontmatter(readFileSync(new URL('index.md', dir), 'utf8'));
  const frames = readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => ({ id: f.slice(0, -5), ...JSON.parse(readFileSync(new URL(f, dir), 'utf8')) }))
    .sort((a, b) => a.taken.localeCompare(b.taken));
  if (!frames.length) continue;
  const cover = original.cover ? frames.find((f) => f.id === original.cover) : frames[0];
  if (!cover) throw new Error(`${id}: cover ${original.cover} is not one of its photos`);
  const base = {
    id,
    count: frames.length,
    country: cover.place.country,
    coverFile: smallestAtLeast(cover.variants.webp, OG_COVER_WIDTH).file,
    focus: focusOf(original.focus),
  };
  cards.push(seriesCard({ ...base, title: original.title }, original.lang));
  for (const file of translationsIn(dir)) {
    const t = frontmatter(readFileSync(new URL(file, dir), 'utf8'));
    cards.push(seriesCard({ ...base, title: t.title }, file.slice(0, 2)));
  }
}
for (const lang of locales) for (const section of ogSections) cards.push(sectionCard(section, lang));

mkdirSync(out, { recursive: true });
const wanted = new Map(await Promise.all(cards.map(async (c) => [(await ogImagePathFor(c)).slice(OG_DIR.length), c])));
const missing = [...wanted].filter(([name]) => !existsSync(new URL(name, out)));
for (const stale of readdirSync(out).filter((f) => !wanted.has(f))) {
  rmSync(new URL(stale, out));
  console.log(`− ${OG_DIR}${stale}`);
}

if (missing.length) {
  const chrome = await launchChrome({ port: 9341 });
  try {
    const { targetId } = await chrome.send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await chrome.send('Target.attachToTarget', { targetId, flatten: true });
    const send = (method, params) => chrome.send(method, params, sessionId);
    await send('Page.enable');
    await send('Emulation.setDeviceMetricsOverride', { ...OG_SIZE, deviceScaleFactor: 1, mobile: false });
    const page = join(process.env.TMPDIR ?? '/tmp', 'og-card.html');
    for (const [name, card] of missing) {
      writeFileSync(page, ogCardHtml(card, asset));
      await send('Page.navigate', { url: pathToFileURL(page).href });
      const { result } = await send('Runtime.evaluate', {
        expression: 'document.fonts.ready.then(() => document.fonts.size)',
        awaitPromise: true,
      });
      if (!result.value) throw new Error(`${name}: fonts did not load`);
      const { data } = await send('Page.captureScreenshot', {
        format: 'png',
        clip: { x: 0, y: 0, ...OG_SIZE, scale: 1 },
      });
      const png = Buffer.from(data, 'base64');
      const chunks = [...new Set(pngChunks(png))].sort().join(' ');
      if (chunks !== 'IDAT IEND IHDR') throw new Error(`${name}: unexpected PNG chunks ${chunks}`);
      writeFileSync(new URL(name, out), png);
      console.log(`+ ${OG_DIR}${name}`);
    }
    rmSync(page, { force: true });
  } finally {
    chrome.close();
  }
}
console.log(`✓ ${wanted.size} share images in public${OG_DIR} (${missing.length} rendered)`);
