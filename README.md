# yakar.me

Source of [yakar.me](https://yakar.me), my personal site: writing, photo series, a map of where they were taken,
reading, playing, years in numbers and an about page — in English, Turkish and Spanish.

Built with [Astro](https://astro.build) and [Tailwind CSS](https://tailwindcss.com), served as static assets on
Cloudflare Workers. There is no server code.

## Principles

- **Everything is served from the site.** No third-party scripts, styles, fonts, images, CDNs or embeds.
- **No inline code.** No inline `<script>`, `<style>` or `style=""`; the Content Security Policy allows `'self'` only and
  requires Trusted Types. The build output is checked for violations.
- **Three languages, one structure.** English at the root, Turkish under `/tr/`, Spanish under `/es/`. Every article and
  series is published in all three; a missing translation fails the build.
- **Checked before it ships.** Types, unit tests, the build output, page weight budgets and accessibility (axe-core,
  WCAG 2.2 AA) run on every pull request; the live site, its headers and its outbound links are checked on a schedule.

## Requirements

- Node 24 (see `.nvmrc`) and npm
- Chrome or Chromium for the browser checks (`check:pages`) and share images (`og:render`)

Photo variants and map tiles live in a private bucket and are not in the repository. `photos:fetch` and `map:fetch` need
read credentials, so only I can run a full build; the unit tests run without them.

## Commands

| Command | What it does |
|---|---|
| `npm ci` | Install dependencies from the lockfile |
| `npm run dev` | Astro development server (`_headers` are not applied) |
| `npm run check` | Type check (`astro check`) |
| `npm test` | Unit tests (`node --test`, no dependencies) |
| `npm run build` | Type check and build to `dist/` |
| `npm run preview` | Serve `dist/` with `wrangler dev`, headers applied (`localhost:8787`) |
| `npm run format` | Format the code with Prettier |
| `npm run check:format` | Check that the code is formatted |
| `npm run check:dist` | Check the build output: inline code, external resources, broken links, structured data, language counterparts, feeds |
| `npm run check:pages` | Page weight budgets and accessibility in headless Chrome, phone and desktop, dark and light theme |
| `npm run check:audit` | `npm audit` against a dated list of reviewed advisories |
| `npm run check:live` | Compare the live site with the repository: headers, status codes, email DNS, certificate, `security.txt` |
| `npm run check:links` | Check outbound links on the live site |
| `npm run og:render` | Render share images to `public/og/` |

These need access to the bucket, so only I can run them: `photo:add` (add a photo to a series), `photos:fetch`,
`map:extract`, `map:fetch`.

## Layout

```
src/content/    Articles, photo series, about page, books, songs, districts
src/pages/      Routes; every page under [...lang]/ is built once per language
src/components/ Astro components
src/layouts/    Page shell: menu, metadata, theme
src/lib/        Pure functions (tested) and content collections
src/scripts/    Client-side modules
src/styles/     Design tokens, article, print and map styles, fonts
src/i18n/       Interface text in every language
public/         Headers, theme script, icons, share images, map glyphs, security.txt
scripts/        Build checks, live checks, photo and map tasks
tests/          Unit tests
```

## Security

Please report vulnerabilities to the contact in
[`/.well-known/security.txt`](https://yakar.me/.well-known/security.txt).

## License

The code is copyright © 2026 Ahmet Yakar and licensed under the [GNU General Public License v3.0](LICENSE).

My writing, my photographs and my γ mark are not covered by the GPL. They are copyright © 2019–2026 Ahmet Yakar, all
rights reserved:

- the articles and their images (`src/content/writing/`)
- the photo series texts (`src/content/photos/`)
- the about page (`src/content/pages/`, `src/content/about.json`)
- the share images (`public/og/`)
- the photographs published on yakar.me (not in this repository)
- the γ mark: its drawing (`src/lib/mark-drawing.ts`), the icons made from it (`public/favicon.svg`,
  `public/favicon.ico`, `public/apple-touch-icon.png`, `public/feed.png`) and every rendering of it on the site

To reuse any of them, ask me first at ahmet@yakar.me. A fork of the code has to replace the mark with its own.

Third-party material:

- Map data © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors, under the Open Database License,
  via [Protomaps](https://protomaps.com)
- Map rendering: [MapLibre GL JS](https://maplibre.org) © MapLibre contributors, under the BSD 3-Clause License; the
  full text, including the notices for the code it contains, is in
  [`public/licenses/maplibre-gl.txt`](public/licenses/maplibre-gl.txt), served at `/licenses/maplibre-gl.txt`
- The photograph of my saxophone teacher on the Playing page (`src/assets/cihan-gulmez.jpg`) © Cihan Gülmez, used with
  permission
- Home page globe: [Natural Earth](https://www.naturalearthdata.com) (public domain), via `world-atlas`
- Fonts, under the SIL Open Font License 1.1: Geist and Geist Mono © The Geist Project Authors, Newsreader © The
  Newsreader Project Authors, Instrument Serif © The Instrument Serif Project Authors. The map glyphs in
  `public/glyphs/` are generated from Geist and Instrument Serif. The license is in
  [`public/licenses/OFL.txt`](public/licenses/OFL.txt), served at `/licenses/OFL.txt`.
