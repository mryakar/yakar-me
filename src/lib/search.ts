import type { sections } from '../site.ts';

type SearchKind = (typeof sections)[number];

export interface SearchEntry {
  kind: SearchKind;
  url: string;
  title: string;
  date: string;
  detail: string;
  keywords: string[];
  body: string;
}

interface Segment {
  text: string;
  mark: boolean;
}

export interface SearchResult {
  entry: SearchEntry;
  snippet: Segment[];
}

export const QUERY_MAX = 100;
const TERMS_MAX = 8;
const SNIPPET_BEFORE = 60;
const SNIPPET_AFTER = 120;
const WEIGHT = { title: 8, detail: 4, keywords: 2, body: 1 } as const;
const WORD = /[\p{L}\p{N}]/u;

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

export const decodeEntities = (s: string) =>
  s.replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z]+);/gi, (whole, name: string) => {
    if (name[0] !== '#') return ENTITIES[name.toLowerCase()] ?? whole;
    const code = name[1] === 'x' || name[1] === 'X' ? parseInt(name.slice(2), 16) : Number(name.slice(1));
    return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : whole;
  });

const BLOCK =
  /<\/?(?:address|article|aside|blockquote|br|dd|div|dl|dt|figcaption|figure|footer|h[1-6]|header|hr|li|main|nav|ol|p|pre|section|table|tbody|td|tfoot|th|thead|tr|ul)\b[^>]*>/gi;

export const plainText = (html: string) =>
  decodeEntities(
    html
      .replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, ' ')
      .replace(BLOCK, ' ')
      .replace(/<[^>]*>/g, ''),
  )
    .replace(/\s+/g, ' ')
    .trim();

export const headings = (html: string) =>
  [...html.matchAll(/<h[23]\b[^>]*>([\s\S]*?)<\/h[23]>/gi)].map((m) => plainText(m[1])).filter(Boolean);

function foldChar(c: string) {
  if (c === 'İ' || c === 'I' || c === 'ı') return 'i';
  const folded = c.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
  return folded.length === 1 ? folded : c;
}

export function fold(s: string) {
  let out = '';
  for (let i = 0; i < s.length; i++) out += foldChar(s[i]);
  return out;
}

export const queryTerms = (query: string) =>
  [
    ...new Set(
      fold(query.slice(0, QUERY_MAX))
        .split(/[^\p{L}\p{N}]+/u)
        .filter(Boolean),
    ),
  ].slice(0, TERMS_MAX);

function wordStarts(folded: string, term: string) {
  const at: number[] = [];
  for (let i = folded.indexOf(term); i !== -1; i = folded.indexOf(term, i + 1)) {
    if (i === 0 || !WORD.test(folded[i - 1])) at.push(i);
  }
  return at;
}

export interface Prepared {
  entry: SearchEntry;
  folded: { title: string; detail: string; keywords: string; body: string };
}

export const prepare = (entries: SearchEntry[]): Prepared[] =>
  entries.map((entry) => ({
    entry,
    folded: {
      title: fold(entry.title),
      detail: fold(entry.detail),
      keywords: fold(entry.keywords.join(' · ')),
      body: fold(entry.body),
    },
  }));

export function snippet(text: string, folded: string, terms: string[]): Segment[] {
  const hits = terms
    .flatMap((t) => wordStarts(folded, t).map((start) => [start, start + t.length] as const))
    .sort((a, b) => a[0] - b[0]);
  if (hits.length === 0) return [];
  let from = Math.max(0, hits[0][0] - SNIPPET_BEFORE);
  let to = Math.min(text.length, hits[0][0] + SNIPPET_AFTER);
  if (from > 0) from = text.indexOf(' ', from) + 1 || from;
  if (to < text.length) to = text.lastIndexOf(' ', to) > hits[0][1] ? text.lastIndexOf(' ', to) : to;
  const segments: Segment[] = [];
  let at = from;
  for (const [start, end] of hits) {
    if (start < at || end > to) continue;
    if (start > at) segments.push({ text: text.slice(at, start), mark: false });
    segments.push({ text: text.slice(start, end), mark: true });
    at = end;
  }
  if (at < to) segments.push({ text: text.slice(at, to), mark: false });
  if (from > 0) segments.unshift({ text: '… ', mark: false });
  if (to < text.length) segments.push({ text: ' …', mark: false });
  return segments;
}

export function search(index: Prepared[], query: string): SearchResult[] {
  const terms = queryTerms(query);
  if (terms.length === 0) return [];
  return index
    .flatMap(({ entry, folded }, order) => {
      let score = 0;
      for (const term of terms) {
        const fields = (Object.keys(WEIGHT) as (keyof typeof WEIGHT)[]).filter(
          (f) => wordStarts(folded[f], term).length > 0,
        );
        if (fields.length === 0) return [];
        score += fields.reduce((sum, f) => sum + WEIGHT[f], 0);
      }
      const inBody = snippet(entry.body, folded.body, terms);
      const inDetail = snippet(entry.detail, folded.detail, terms);
      const shown = inBody.length ? inBody : inDetail.length ? inDetail : [{ text: entry.detail, mark: false }];
      return [{ entry, order, score, snippet: shown }];
    })
    .sort((a, b) => b.score - a.score || a.order - b.order)
    .map(({ entry, snippet }) => ({ entry, snippet }));
}
