import { getCollection } from 'astro:content';
import { centreLookup } from './map';

export const districtCentres = async () => centreLookup((await getCollection('districts')).map(({ data }) => data));
