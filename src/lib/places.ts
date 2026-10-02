import tiles from '../content/map.json';
import { allSeries, type Photo } from './photos';
import { districtCentres } from './districts';
import { cityKey, regionProblems, type Bounds, type Region } from './map';
import type { Lang } from './i18n';

export interface MapPlace {
  id: string;
  district: string;
  city: string;
  country: string;
  lat: number;
  lon: number;
  photos: Photo[];
  series: { id: string; title: string }[];
  cover: Photo;
}

export interface MapCity {
  city: string;
  country: string;
  bounds: Bounds;
  places: MapPlace[];
  photos: number;
}

const cut: Region[] = tiles.regions.map((r) => ({ ...r, bounds: r.bounds as Bounds }));

export async function mapPlaces(lang: Lang): Promise<MapCity[]> {
  const [series, centreOf] = await Promise.all([allSeries(lang), districtCentres()]);
  const places = new Map<string, MapPlace>();
  for (const s of series) {
    for (const photo of s.photos) {
      const { id, district, city, country, lat, lon } = centreOf(photo.data.place);
      const place = places.get(id) ?? { id, district, city, country, lat, lon, photos: [], series: [], cover: photo };
      place.photos.push(photo);
      if (!place.series.some((x) => x.id === s.id)) place.series.push({ id: s.id, title: s.title });
      if (photo === s.cover) place.cover = photo;
      places.set(id, place);
    }
  }
  const problems = regionProblems([...places.values()], cut);
  if (problems.length) throw new Error(`Map tiles are out of date (run npm run map:extract):\n${problems.join('\n')}`);
  const regions = new Map(cut.map((r) => [cityKey(r), r.bounds]));
  return [...Map.groupBy(places.values(), cityKey).values()]
    .map((ps) => ({
      city: ps[0].city,
      country: ps[0].country,
      bounds: regions.get(cityKey(ps[0]))!,
      places: ps.sort((a, b) => b.photos.length - a.photos.length || a.district.localeCompare(b.district)),
      photos: ps.reduce((n, p) => n + p.photos.length, 0),
    }))
    .sort((a, b) => a.city.localeCompare(b.city));
}

export const mapTiles = tiles;
