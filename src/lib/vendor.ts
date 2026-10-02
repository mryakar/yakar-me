import maplibre from 'maplibre-gl/package.json' with { type: 'json' };

export const MAPLIBRE_DIR = `/vendor/maplibre-gl-${maplibre.version}/`;
export const MAPLIBRE_FILES = ['maplibre-gl.mjs', 'maplibre-gl-shared.mjs', 'maplibre-gl-worker.mjs'];
