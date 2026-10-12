import type { APIRoute } from 'astro';
import { ui } from '../../i18n/ui';
import { langPaths, localize, type Lang } from '../../lib/i18n';
import { articles } from '../../lib/writing';
import { allSeries } from '../../lib/photos';
import { books } from '../../lib/books';
import { songs } from '../../lib/songs';
import { placeName, seriesPath } from '../../lib/photo';
import { articlePath } from '../../lib/format';
import { htmlRenderer } from '../../lib/rendered';
import { headings, plainText, type SearchEntry } from '../../lib/search';
import { paths } from '../../site';

export const getStaticPaths = langPaths;

export const GET: APIRoute = async ({ props }) => {
  const { lang } = props as { lang: Lang };
  const t = ui[lang];
  const html = await htmlRenderer();
  const [written, series, shelf, played] = await Promise.all([articles(lang), allSeries(lang), books(lang), songs(lang)]);

  const writing = written.map(async (a): Promise<SearchEntry> => {
    const body = await html(a.entry);
    return { kind: 'writing', url: articlePath(a.id, lang), title: a.title, detail: a.description, keywords: headings(body), body: plainText(body) };
  });
  const photos = series.map(async (s): Promise<SearchEntry> => ({
    kind: 'photos',
    url: seriesPath(s.id, lang),
    title: s.title,
    detail: s.description,
    keywords: [...new Set(s.photos.map((p) => placeName(p.data.place, t.photos.country)))],
    body: plainText(await html(s.entry)),
  }));
  const reading = [...shelf.reading, ...shelf.finished].map(
    (b): SearchEntry => ({
      kind: 'reading',
      url: `${localize(paths.reading, lang)}#${b.id}`,
      title: b.title,
      detail: b.author,
      keywords: b.originalTitle === b.title ? [] : [b.originalTitle],
      body: '',
    }),
  );
  const playing = played.all.map(
    (s): SearchEntry => ({
      kind: 'playing',
      url: `${localize(paths.playing, lang)}#${s.id}`,
      title: s.title,
      detail: s.artist,
      keywords: [s.album],
      body: '',
    }),
  );

  const index = [...(await Promise.all([...writing, ...photos])), ...reading, ...playing];
  return new Response(JSON.stringify(index), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
};
