import { getCollection } from 'astro:content';
import { placeKey } from './map';
import type { Place } from './photo';

export async function districtCentres() {
  const centres = new Map((await getCollection('districts')).map(({ data }) => [placeKey(data), data]));
  return (place: Place) => {
    const centre = centres.get(placeKey(place));
    if (!centre) throw new Error(`No district centre for "${placeKey(place)}" — add it to src/content/districts.json`);
    return centre;
  };
}
