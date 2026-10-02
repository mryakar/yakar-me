import type { ExpressionSpecification, LayerSpecification, StyleSpecification } from 'maplibre-gl';
import type { Bounds } from './map';

export const PALETTE_TOKENS = ['bg', 'ocean', 'land', 'coast', 'frontier', 'line', 'line-strong', 'faint'] as const;
export type Palette = Record<(typeof PALETTE_TOKENS)[number], string>;

export const GLYPHS = '/glyphs/{fontstack}/{range}.pbf';

export interface StyleInput {
  palette: Palette;
  lang: string;
  origin: string;
  tiles: string;
  worldMaxZoom: number;
  cityZooms: number[];
  regions: Bounds[];
  ours: string[];
}

export function mapStyle({ palette: c, lang, origin, tiles, worldMaxZoom, cityZooms, regions, ours }: StyleInput): StyleSpecification {
  const name: ExpressionSpecification =
    lang === 'tr' ? ['coalesce', ['get', 'name:tr'], ['get', 'name:en']] : ['get', 'name:en'];
  const cities = regions.map((bounds, i) => ({ id: `city-${i}`, bounds }));
  const source = { type: 'vector' as const, tiles: [`${origin}${tiles}`] };
  const base = (id: string, detail: boolean): LayerSpecification[] => [
    { id: `${id}-earth`, type: 'fill', source: id, 'source-layer': 'earth', paint: { 'fill-color': c.land } },
    { id: `${id}-water`, type: 'fill', source: id, 'source-layer': 'water', paint: { 'fill-color': c.ocean } },
    {
      id: `${id}-coast`,
      type: 'line',
      source: id,
      'source-layer': 'earth',
      paint: { 'line-color': c.coast, 'line-opacity': 0.55, 'line-width': ['interpolate', ['linear'], ['zoom'], 0, 0.4, 12, 1] },
    },
    ...(detail
      ? ([
          {
            id: `${id}-roads`,
            type: 'line',
            source: id,
            'source-layer': 'roads',
            minzoom: 10,
            filter: ['in', ['get', 'kind'], ['literal', ['minor_road', 'other']]],
            paint: { 'line-color': c.line, 'line-opacity': 0.6, 'line-width': ['interpolate', ['linear'], ['zoom'], 12, 0.5, 16, 3] },
          },
          {
            id: `${id}-roads-major`,
            type: 'line',
            source: id,
            'source-layer': 'roads',
            minzoom: 8,
            filter: ['in', ['get', 'kind'], ['literal', ['highway', 'major_road', 'medium_road']]],
            paint: { 'line-color': c['line-strong'], 'line-opacity': 0.7, 'line-width': ['interpolate', ['linear'], ['zoom'], 8, 0.4, 16, 3] },
          },
          {
            id: `${id}-buildings`,
            type: 'fill',
            source: id,
            'source-layer': 'buildings',
            minzoom: 14,
            paint: { 'fill-color': c.line },
          },
        ] satisfies LayerSpecification[])
      : []),
    {
      id: `${id}-borders`,
      type: 'line',
      source: id,
      'source-layer': 'boundaries',
      filter: ['==', ['get', 'kind'], 'country'],
      paint: { 'line-color': c.frontier, 'line-width': 1 },
    },
  ];
  return {
    version: 8,
    projection: { type: 'globe' },
    sky: { 'atmosphere-blend': 0 },
    glyphs: `${origin}${GLYPHS}`,
    sources: {
      world: { ...source, minzoom: 0, maxzoom: worldMaxZoom },
      ...Object.fromEntries(
        cities.map((s) => [s.id, { ...source, minzoom: cityZooms[0], maxzoom: cityZooms[1], bounds: s.bounds }]),
      ),
    },
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': c.ocean } },
      ...base('world', false),
      ...cities.flatMap((s) => base(s.id, true)),
      {
        id: 'countries',
        type: 'symbol',
        source: 'world',
        'source-layer': 'places',
        minzoom: 2,
        maxzoom: 6,
        filter: ['==', ['get', 'kind'], 'country'],
        layout: {
          'text-field': name,
          'text-font': ['geist-regular'],
          'text-size': 11,
          'text-transform': 'uppercase',
          'text-letter-spacing': 0.12,
          'text-max-width': 8,
        },
        paint: { 'text-color': c.faint, 'text-halo-color': c.bg, 'text-halo-width': 1.2 },
      },
      ...cities.map(
        (s): LayerSpecification => ({
          id: `${s.id}-localities`,
          type: 'symbol',
          source: s.id,
          'source-layer': 'places',
          minzoom: 9,
          filter: [
            'all',
            ['==', ['get', 'kind'], 'locality'],
            ['<=', ['get', 'min_zoom'], ['-', ['zoom'], 3]],
            ['!', ['in', ['get', 'name:en'], ['literal', ours]]],
          ],
          layout: {
            'text-field': name,
            'text-font': ['instrument-serif-italic'],
            'text-size': ['interpolate', ['linear'], ['zoom'], 9, 15, 13, 20],
            'text-max-width': 8,
          },
          paint: { 'text-color': c.faint, 'text-halo-color': c.bg, 'text-halo-width': 1.2 },
        }),
      ),
    ],
  };
}
