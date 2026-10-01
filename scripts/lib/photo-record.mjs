export const FILM_SIMULATIONS = {
  0x000: 'Provia',
  0x120: 'Astia',
  0x200: 'Velvia',
  0x400: 'Velvia',
  0x500: 'Pro Neg. Std',
  0x501: 'Pro Neg. Hi',
  0x600: 'Classic Chrome',
  0x700: 'Eterna',
  0x800: 'Classic Neg.',
  0x900: 'Eterna Bleach Bypass',
  0xa00: 'Nostalgic Neg.',
  0xb00: 'Reala Ace',
};
const MONOCHROME = {
  0x300: 'Monochrome',
  0x301: 'Monochrome + R',
  0x302: 'Monochrome + Ye',
  0x303: 'Monochrome + G',
  0x310: 'Sepia',
  0x500: 'Acros',
  0x501: 'Acros + R',
  0x502: 'Acros + Ye',
  0x503: 'Acros + G',
};
export const FILM_SIMULATION_NAMES = [...new Set([...Object.values(FILM_SIMULATIONS), ...Object.values(MONOCHROME)])];
const COLOR = { 0x000: 0, 0x080: 1, 0x100: 2, 0x0c0: 3, 0x0e0: 4, 0x180: -1, 0x400: -2, 0x4c0: -3, 0x4e0: -4 };
const NOISE_REDUCTION = { 0x000: 0, 0x180: 1, 0x100: 2, 0x1c0: 3, 0x1e0: 4, 0x280: -1, 0x200: -2, 0x2c0: -3, 0x2e0: -4 };
const WHITE_BALANCE = {
  0x0: 'Auto',
  0x1: 'Auto (white priority)',
  0x2: 'Auto (ambience priority)',
  0x100: 'Daylight',
  0x200: 'Shade',
  0x300: 'Fluorescent 1',
  0x301: 'Fluorescent 2',
  0x302: 'Fluorescent 3',
  0x400: 'Incandescent',
  0x600: 'Underwater',
  0xf00: 'Custom 1',
  0xf01: 'Custom 2',
  0xf02: 'Custom 3',
};
const EFFECT = { 0: 'Off', 32: 'Weak', 64: 'Strong' };
const GRAIN_SIZE = { 0: 'Off', 16: 'Small', 32: 'Large' };
const DRANGE_PRIORITY = { 1: 'Weak', 2: 'Strong', 3: 'Plus' };

export class PhotoError extends Error {}

const TEXT = /^[\x20-\x7e]{1,60}$/;
const text = (value, name) => {
  const s = String(value ?? '').trim();
  if (!TEXT.test(s)) throw new PhotoError(`${name}: expected short printable ASCII, got ${JSON.stringify(value)}`);
  return s;
};
const number = (value, name, min, max) => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
    throw new PhotoError(`${name}: expected a number in [${min}, ${max}], got ${JSON.stringify(value)}`);
  }
  return value;
};
const lookup = (table, value, name) => {
  if (!(value in table)) throw new PhotoError(`${name}: unknown value ${JSON.stringify(value)}`);
  return table[value];
};
const round = (n, digits) => Number(n.toFixed(digits));

export const photoId = (file) =>
  file
    .replace(/^.*[\\/]/, '')
    .replace(/\.[^.]+$/, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

export const cameraFrame = (file) => /^(DSCF\d{4})$/i.exec(file.replace(/^.*[\\/]/, '').replace(/\.[^.]+$/, ''))?.[1].toUpperCase();

export function kindOf(exif) {
  const make = text(exif.Make, 'Make').toUpperCase();
  if (make === 'FUJIFILM') return 'fujifilm';
  if (make === 'APPLE') return 'phone';
  throw new PhotoError(`Make: only Fujifilm and Apple are supported, got ${JSON.stringify(exif.Make)}`);
}

export function takenAt(exif) {
  const m = /^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/.exec(String(exif.DateTimeOriginal ?? ''));
  if (!m) throw new PhotoError(`DateTimeOriginal: missing or malformed (${JSON.stringify(exif.DateTimeOriginal)})`);
  const offset = /^[+-]\d{2}:\d{2}$/.test(exif.OffsetTimeOriginal ?? '') ? exif.OffsetTimeOriginal : '';
  return `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}${offset}`;
}

export function location(exif) {
  if (exif.GPSLatitude === undefined || exif.GPSLongitude === undefined) return undefined;
  return {
    lat: round(number(exif.GPSLatitude, 'GPSLatitude', -90, 90), 5),
    lon: round(number(exif.GPSLongitude, 'GPSLongitude', -180, 180), 5),
  };
}

export function parsePlace(answer) {
  const parts = String(answer ?? '').split(',').map((s) => s.trim());
  if (parts.length !== 3) throw new PhotoError(`place: expected "District, City, Country", got ${JSON.stringify(answer)}`);
  const [district, city, country] = parts.map((p, i) => text(p, ['district', 'city', 'country'][i]));
  return { district, city, country };
}

export function readShot(exif) {
  const kind = kindOf(exif);
  const shot = {
    kind,
    make: kind === 'fujifilm' ? 'Fujifilm' : 'Apple',
    model: text(exif.Model, 'Model'),
    taken: takenAt(exif),
    aperture: round(number(exif.FNumber, 'FNumber', 0.7, 64), 1),
    shutter: number(exif.ExposureTime, 'ExposureTime', 1 / 64000, 3600),
    iso: Math.round(number(exif.ISO, 'ISO', 1, 409600)),
  };
  if (kind === 'fujifilm') {
    shot.lens = text(exif.LensModel, 'LensModel');
    shot.focalLength = Math.round(number(exif.FocalLength, 'FocalLength', 1, 2000));
  } else {
    shot.focalLength = Math.round(number(exif.FocalLengthIn35mmFormat, 'FocalLengthIn35mmFormat', 1, 2000));
  }
  return shot;
}

export function hasRecipe(exif) {
  return exif.FilmMode !== undefined || (exif.Saturation !== undefined && exif.Saturation in MONOCHROME);
}

function dynamicRange(exif) {
  if (exif.DRangePriority !== undefined) {
    if (exif.DRangePriority === 0) return `D-Range Priority ${lookup(DRANGE_PRIORITY, exif.DRangePriorityAuto, 'DRangePriorityAuto')}`;
    return `D-Range Priority ${lookup(DRANGE_PRIORITY, exif.DRangePriorityFixed, 'DRangePriorityFixed')}`;
  }
  if (exif.DynamicRangeSetting === 0) return 'DR Auto';
  return `DR${lookup({ 100: 100, 200: 200, 400: 400 }, exif.DevelopmentDynamicRange ?? 100, 'DevelopmentDynamicRange')}`;
}

function tone(value, name) {
  const t = -number(value, name, -64, 64) / 16;
  if (!Number.isInteger(t * 2)) throw new PhotoError(`${name}: unexpected value ${value}`);
  return t;
}

export function readRecipe(exif) {
  const mono = exif.Saturation in MONOCHROME;
  const recipe = {
    filmSimulation: mono ? MONOCHROME[exif.Saturation] : lookup(FILM_SIMULATIONS, exif.FilmMode, 'FilmMode'),
    dynamicRange: dynamicRange(exif),
    highlight: tone(exif.HighlightTone ?? 0, 'HighlightTone'),
    shadow: tone(exif.ShadowTone ?? 0, 'ShadowTone'),
  };
  if (!mono) recipe.color = lookup(COLOR, exif.Saturation ?? 0, 'Saturation');
  if (mono && exif.BWAdjustment !== undefined) {
    recipe.monochromaticColor = [
      number(exif.BWAdjustment, 'BWAdjustment', -18, 18),
      number(exif.BWMagentaGreen ?? 0, 'BWMagentaGreen', -18, 18),
    ];
  }
  recipe.whiteBalance =
    exif.WhiteBalance === 0xff0
      ? `${Math.round(number(exif.ColorTemperature, 'ColorTemperature', 2000, 12000))}K`
      : lookup(WHITE_BALANCE, exif.WhiteBalance ?? 0, 'WhiteBalance');
  const shift = String(exif.WhiteBalanceFineTune ?? '0 0').split(/\s+/).map(Number);
  if (shift.length !== 2 || shift.some((v) => !Number.isInteger(v / 20) || Math.abs(v / 20) > 9)) {
    throw new PhotoError(`WhiteBalanceFineTune: unexpected value ${JSON.stringify(exif.WhiteBalanceFineTune)}`);
  }
  recipe.whiteBalanceShift = shift.map((v) => v / 20 + 0);
  recipe.noiseReduction = lookup(NOISE_REDUCTION, exif.NoiseReduction ?? 0, 'NoiseReduction');
  recipe.clarity = lookup({ '-5000': -5, '-4000': -4, '-3000': -3, '-2000': -2, '-1000': -1, 0: 0, 1000: 1, 2000: 2, 3000: 3, 4000: 4, 5000: 5 }, exif.Clarity ?? 0, 'Clarity');
  const roughness = lookup(EFFECT, exif.GrainEffectRoughness ?? 0, 'GrainEffectRoughness');
  const size = lookup(GRAIN_SIZE, exif.GrainEffectSize ?? 0, 'GrainEffectSize');
  recipe.grain = roughness === 'Off' ? 'Off' : size === 'Off' ? roughness : `${roughness}, ${size}`;
  recipe.colorChrome = lookup(EFFECT, exif.ColorChromeEffect ?? 0, 'ColorChromeEffect');
  recipe.colorChromeBlue = lookup(EFFECT, exif.ColorChromeFXBlue ?? 0, 'ColorChromeFXBlue');
  return recipe;
}

export const EXIFTOOL_TAGS = [
  'Make', 'Model', 'LensModel', 'FNumber', 'ExposureTime', 'ISO', 'FocalLength', 'FocalLengthIn35mmFormat',
  'DateTimeOriginal', 'OffsetTimeOriginal', 'GPSLatitude', 'GPSLongitude', 'ImageWidth', 'ImageHeight',
  'FilmMode', 'Saturation', 'HighlightTone', 'ShadowTone', 'WhiteBalance', 'WhiteBalanceFineTune', 'ColorTemperature',
  'NoiseReduction', 'Clarity', 'GrainEffectRoughness', 'GrainEffectSize', 'ColorChromeEffect', 'ColorChromeFXBlue',
  'DynamicRangeSetting', 'DevelopmentDynamicRange', 'DRangePriority', 'DRangePriorityAuto', 'DRangePriorityFixed',
  'BWAdjustment', 'BWMagentaGreen',
];
