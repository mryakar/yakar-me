import type { APIRoute, InferGetStaticPropsType } from 'astro';
import { ui } from '../../i18n/ui';
import { langPaths } from '../../lib/i18n';
import { articles } from '../../lib/writing';
import { allSeries, lastTaken } from '../../lib/photos';
import { books } from '../../lib/books';
import { bookPath } from '../../lib/book';
import { songs } from '../../lib/songs';
import { songPath } from '../../lib/song';
import { placeName, seriesPath, takenMonth } from '../../lib/photo';
import { articlePath, formatDate, formatMonth, monthStart } from '../../lib/format';
import { htmlRenderer } from '../../lib/rendered';
import { headings, plainText, type SearchEntry } from '../../lib/search';

export const getStaticPaths = langPaths;

export const GET: APIRoute<InferGetStaticPropsType<typeof getStaticPaths>> = async ({ props }) => {
  const { lang } = props;
  const t = ui[lang];
  const html = await htmlRenderer();
  const [written, series, shelf, played] = await Promise.all([articles(lang), allSeries(lang), books(lang), songs(lang)]);

  const writing = written.map(async (a): Promise<SearchEntry> => {
    const body = await html(a.entry);
    return { kind: 'writing', url: articlePath(a.id, lang), title: a.title, date: formatDate(a.pubDate, 'short', lang), detail: a.description, keywords: headings(body), body: plainText(body) };
  });
  const photos = series.map(async (s): Promise<SearchEntry> => ({
    kind: 'photos',
    url: seriesPath(s.id, lang),
    title: s.title,
    date: formatMonth(takenMonth(lastTaken(s.photos)), lang),
    detail: s.description,
    keywords: [...new Set(s.photos.map((p) => placeName(p.data.place, t.photos.country)))],
    body: plainText(await html(s.entry)),
  }));
  const reading = [...shelf.reading, ...shelf.finished].map(
    (b): SearchEntry => ({
      kind: 'reading',
      url: bookPath(b.id, lang),
      title: b.title,
      date: 'finished' in b ? formatMonth(b.finished, lang) : '',
      detail: b.author,
      keywords: b.originalTitle === b.title ? [] : [b.originalTitle],
      body: '',
    }),
  );
  const playing = played.all.map(
    (s): SearchEntry => ({
      kind: 'playing',
      url: songPath(s.id, lang),
      title: s.title,
      date: s.firstPlayed ? formatMonth(monthStart(s.firstPlayed), lang) : '',
      detail: s.artist,
      keywords: [s.album],
      body: '',
    }),
  );

  const index = [...(await Promise.all([...writing, ...photos])), ...reading, ...playing];
  return new Response(JSON.stringify(index), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
};
