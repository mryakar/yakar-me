import type { Place, Point } from './measure';

export type Bounds = [west: number, south: number, east: number, north: number];

export interface District extends Place, Point {
  district: string;
}

export interface Region extends Place {
  bounds: Bounds;
}

export const REGION_PADDING_KM = 10;
export const MAX_MERCATOR_LAT = 85;
const KM_PER_DEGREE = 111.32;
const RAD = Math.PI / 180;

export const tileRoot = (sha256: string) => `/tiles/${sha256.slice(0, 8)}/`;

export const placeKey = (p: Place & { district: string }) => `${p.district}, ${p.city}, ${p.country}`;
export const cityKey = (p: Place) => `${p.city}, ${p.country}`;

export function centreLookup<T extends District>(table: T[]) {
  const centres = new Map(table.map((d) => [placeKey(d), d]));
  return (place: Place & { district: string }) => {
    const centre = centres.get(placeKey(place));
    if (!centre) throw new Error(`No district centre for "${placeKey(place)}" — add it to src/content/districts.json`);
    return centre;
  };
}

const round = (v: number) => Math.round(v * 1e5) / 1e5;

export function bounds(points: Point[]): Bounds {
  if (points.length === 0) throw new Error('no points to bound');
  const lats = points.map((p) => p.lat);
  const lons = points.map((p) => p.lon);
  return [Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)];
}

export const boundsMiddle = (points: Point[]): Point => {
  const [west, south, east, north] = bounds(points);
  return { lat: (south + north) / 2, lon: (west + east) / 2 };
};

export function padded(points: Point[], km: number): Bounds {
  const [west, south0, east, north0] = bounds(points);
  const south = Math.max(-MAX_MERCATOR_LAT, south0 - km / KM_PER_DEGREE);
  const north = Math.min(MAX_MERCATOR_LAT, north0 + km / KM_PER_DEGREE);
  const widest = Math.max(Math.abs(south), Math.abs(north));
  const dLon = km / (KM_PER_DEGREE * Math.cos(widest * RAD));
  return [round(Math.max(-180, west - dLon)), round(south), round(Math.min(180, east + dLon)), round(north)];
}

export function regions(districts: District[], km = REGION_PADDING_KM): Region[] {
  const byCity = Map.groupBy(districts, cityKey);
  return [...byCity.values()]
    .map((ds) => ({ city: ds[0].city, country: ds[0].country, bounds: padded(ds, km) }))
    .sort((a, b) => a.country.localeCompare(b.country) || a.city.localeCompare(b.city));
}

export const contains = ([west, south, east, north]: Bounds, { lat, lon }: Point) =>
  lon >= west && lon <= east && lat >= south && lat <= north;

export function regionProblems(districts: District[], cut: Region[]) {
  const problems: string[] = [];
  const byCity = new Map(cut.map((r) => [cityKey(r), r]));
  for (const d of districts) {
    const region = byCity.get(cityKey(d));
    if (!region) problems.push(`${cityKey(d)} has photos but no map tiles`);
    else if (!contains(region.bounds, d)) problems.push(`${placeKey(d)} lies outside the tiles cut for ${cityKey(d)}`);
  }
  const photographed = new Set(districts.map(cityKey));
  for (const r of cut) if (!photographed.has(cityKey(r))) problems.push(`tiles are cut for ${cityKey(r)}, which has no photos`);
  return problems;
}

export function centre(points: Point[]): Point {
  const v = points.reduce(
    (acc, { lat, lon }) => {
      acc.x += Math.cos(lat * RAD) * Math.cos(lon * RAD);
      acc.y += Math.cos(lat * RAD) * Math.sin(lon * RAD);
      acc.z += Math.sin(lat * RAD);
      return acc;
    },
    { x: 0, y: 0, z: 0 },
  );
  return { lat: round(Math.atan2(v.z, Math.hypot(v.x, v.y)) / RAD), lon: round(Math.atan2(v.y, v.x) / RAD) };
}
