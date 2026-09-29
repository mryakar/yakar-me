import { getCollection, type CollectionEntry } from 'astro:content';

export type Series = CollectionEntry<'series'>;
export type Photo = CollectionEntry<'photos'>;

export const seriesOf = (photo: Photo) => photo.id.split('/')[0];
export const photoSlug = (photo: Photo) => photo.id.split('/')[1];

export async function allSeries() {
  const [series, photos] = await Promise.all([getCollection('series'), getCollection('photos')]);
  const known = new Set(series.map((s) => s.id));
  const orphan = photos.find((p) => !known.has(seriesOf(p)));
  if (orphan) throw new Error(`photo ${orphan.id} belongs to no series`);
  return series
    .sort((a, b) => a.data.order - b.data.order)
    .map((s) => ({
      series: s,
      photos: photos.filter((p) => seriesOf(p) === s.id).sort((a, b) => a.data.taken.localeCompare(b.data.taken)),
    }))
    .filter((s) => s.photos.length > 0);
}

export const largest = (variants: Photo['data']['variants']['webp']) => variants.reduce((a, b) => (b.width > a.width ? b : a));
export const smallestAtLeast = (variants: Photo['data']['variants']['webp'], width: number) =>
  [...variants].sort((a, b) => a.width - b.width).find((v) => v.width >= width) ?? largest(variants);
