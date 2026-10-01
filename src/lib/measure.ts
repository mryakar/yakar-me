export interface Point {
  lat: number;
  lon: number;
}

export interface Place {
  city: string;
  country: string;
}

const RAD = Math.PI / 180;
const EARTH_RADIUS_KM = 6371;
const DAY_MS = 86_400_000;
const J2000_MS = Date.UTC(2000, 0, 1, 12);
export const SUNSET_ALTITUDE = -0.833;

export function distanceKm(a: Point, b: Point) {
  const h =
    Math.sin(((b.lat - a.lat) * RAD) / 2) ** 2 +
    Math.cos(a.lat * RAD) * Math.cos(b.lat * RAD) * Math.sin(((b.lon - a.lon) * RAD) / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

export function sunAltitude(at: Date, { lat, lon }: Point) {
  const d = (at.getTime() - J2000_MS) / DAY_MS;
  const anomaly = (357.529 + 0.98560028 * d) * RAD;
  const longitude = (280.459 + 0.98564736 * d + 1.915 * Math.sin(anomaly) + 0.02 * Math.sin(2 * anomaly)) * RAD;
  const obliquity = (23.439 - 0.00000036 * d) * RAD;
  const rightAscension = Math.atan2(Math.cos(obliquity) * Math.sin(longitude), Math.cos(longitude));
  const declination = Math.asin(Math.sin(obliquity) * Math.sin(longitude));
  const hourAngle = (280.46061837 + 360.98564736629 * d + lon) * RAD - rightAscension;
  const altitude = Math.asin(
    Math.sin(lat * RAD) * Math.sin(declination) + Math.cos(lat * RAD) * Math.cos(declination) * Math.cos(hourAngle),
  );
  return altitude / RAD;
}

export const afterSunset = (at: Date, place: Point) => sunAltitude(at, place) < SUNSET_ALTITUDE;

function offsetMs(at: Date, timeZone: string) {
  const name = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'longOffset' })
    .formatToParts(at)
    .find((p) => p.type === 'timeZoneName')!.value;
  const m = /^GMT(?:([+-])(\d{2}):(\d{2}))?$/.exec(name);
  if (!m) throw new Error(`Unreadable offset "${name}" for ${timeZone}`);
  return m[1] ? (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3])) * 60_000 : 0;
}

export function takenAt(taken: string, timeZone: string) {
  if (/[+-]\d{2}:\d{2}$/.test(taken)) return new Date(taken);
  const wall = Date.parse(`${taken}Z`);
  const guess = wall - offsetMs(new Date(wall), timeZone);
  return new Date(wall - offsetMs(new Date(guess), timeZone));
}

export const countsAsCountry = (place: Place, home: Place) => place.country !== home.country;

export const countsAsCity = (place: Place, home: Place) =>
  place.city !== place.country && !(place.city === home.city && place.country === home.country);

export function wordCount(markdown: string) {
  const prose = markdown
    .replace(/^[ \t]*(`{3,}|~{3,})[^\n]*\n[\s\S]*?^[ \t]*\1[ \t]*$/gm, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/<[a-z]+:[^>\s]*>/gi, ' ')
    .replace(/\bhttps?:\/\/\S+/g, ' ');
  return prose.match(/[\p{L}\p{N}]+(?:['’.-][\p{L}\p{N}]+)*/gu)?.length ?? 0;
}

export function odometer(value: number, cells: number) {
  const digits = String(value);
  const padded = digits.padStart(cells, '0');
  return [...padded].map((d, i) => ({ digit: Number(d), lead: i < padded.length - digits.length }));
}
