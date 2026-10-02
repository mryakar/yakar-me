import { geoDistance, geoOrthographic, geoPath } from 'd3-geo';
import { feature, mesh } from 'topojson-client';
import type { GeometryCollection, Topology } from 'topojson-specification';
import countries from 'world-atlas/countries-110m.json' with { type: 'json' };
import type { Point } from './measure';

const RAD = Math.PI / 180;
const world = countries as unknown as Topology<{ countries: GeometryCollection; land: GeometryCollection }>;

export function globe(points: Point[], centre: Point, size: number, margin = 4) {
  const projection = geoOrthographic()
    .rotate([-centre.lon, -centre.lat])
    .translate([size / 2, size / 2])
    .scale(size / 2 - margin)
    .precision(0.5);
  const path = geoPath(projection).digits(0);
  const centreLonLat: [number, number] = [centre.lon, centre.lat];
  return {
    sphere: path({ type: 'Sphere' }) ?? '',
    land: path(feature(world, world.objects.land)) ?? '',
    borders: path(mesh(world, world.objects.countries, (a, b) => a !== b)) ?? '',
    dots: points
      .filter((p) => geoDistance([p.lon, p.lat], centreLonLat) < 90 * RAD)
      .map((p) => {
        const [x, y] = projection([p.lon, p.lat])!;
        return { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 };
      }),
  };
}
