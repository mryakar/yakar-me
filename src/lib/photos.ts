import { getCollection, type CollectionEntry } from 'astro:content';
import { pending } from '../i18n/pending';
import type { Lang } from './i18n';
import type { Focus } from './photo';
import { localized } from './translations';

export type Photo = CollectionEntry<'photos'> & { alt: string };

export const seriesOf = (photo: CollectionEntry<'photos'>) => photo.id.split('/')[0];
export const photoSlug = (photo: CollectionEntry<'photos'>) => photo.id.split('/')[1];

export interface Series {
  id: string;
  lang: Lang;
  original: Lang;
  alternate: boolean;
  title: string;
  description: string;
  entry: CollectionEntry<'series'> | CollectionEntry<'seriesTranslations'>;
  photos: Photo[];
  cover: Photo;
  focus?: Focus;
}

export async function allSeries(lang: Lang): Promise<Series[]> {
  const [originals, translations, photos] = await Promise.all([
    getCollection('series'),
    getCollection('seriesTranslations'),
    getCollection('photos'),
  ]);
  const known = new Set(originals.map((s) => s.id));
  const orphan = photos.find((p) => !known.has(seriesOf(p)));
  if (orphan) throw new Error(`photo ${orphan.id} belongs to no series`);
  for (const t of translations) {
    const own = photos.filter((p) => seriesOf(p) === t.id.split('/')[0]).map(photoSlug).sort();
    const given = Object.keys(t.data.alt).sort();
    if (own.join() !== given.join()) {
      throw new Error(`series ${t.id}: alt text for [${given.join(', ')}], photos are [${own.join(', ')}]`);
    }
  }
  return localized('photos', originals.sort((a, b) => a.data.order - b.data.order), (s) => s.data.lang, translations, lang, pending)
    .map(({ original: s, translation: t, alternate }) => {
      const own = photos
        .filter((p) => seriesOf(p) === s.id)
        .sort((a, b) => a.data.taken.localeCompare(b.data.taken))
        .map((p) => ({ ...p, alt: t ? t.data.alt[photoSlug(p)] : p.data.alt }));
      return { s, t, alternate, own };
    })
    .filter(({ own }) => own.length > 0)
    .map(({ s, t, alternate, own }) => {
      const cover = s.data.cover ? own.find((p) => photoSlug(p) === s.data.cover) : own[0];
      if (!cover) throw new Error(`series ${s.id}: cover ${s.data.cover} is not one of its photos`);
      return {
        id: s.id,
        lang,
        original: s.data.lang,
        alternate,
        title: (t ?? s).data.title,
        description: (t ?? s).data.description,
        entry: t ?? s,
        photos: own,
        cover,
        focus: s.data.focus,
      };
    });
}

export const lastTaken = (photos: Photo[]) => photos.at(-1)!.data.taken;

export const recentSeries = async (lang: Lang, count: number) =>
  (await allSeries(lang)).sort((a, b) => lastTaken(b.photos).localeCompare(lastTaken(a.photos))).slice(0, count);

export const largest = (variants: Photo['data']['variants']['webp']) => variants.reduce((a, b) => (b.width > a.width ? b : a));
export const smallestAtLeast = (variants: Photo['data']['variants']['webp'], width: number) =>
  [...variants].sort((a, b) => a.width - b.width).find((v) => v.width >= width) ?? largest(variants);
