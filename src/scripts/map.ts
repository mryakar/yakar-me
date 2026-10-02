import type { Map as MapLibreMap, Marker, StyleSpecification, LayerSpecification, ExpressionSpecification } from 'maplibre-gl';
import { bounds, boundsMiddle, contains, type Bounds } from '../lib/map';

type MapLibre = typeof import('maplibre-gl');

const frame = document.querySelector<HTMLElement>('[data-map]');

const CITY_LEVEL = 8;
const PLACE_ZOOM = 13;
const MERGED_ZOOM = 15;
const MERGE_PX = 28;
const CARD_GAP = 24;
const LABEL_OFFSET = 20;
const SHEET_LIFT = 110;
const CARD_MARGIN = 12;
const FIT_PADDING = 64;
const GLYPHS = '/glyphs/{fontstack}/{range}.pbf';
const TOKENS = ['bg', 'ocean', 'land', 'coast', 'frontier', 'line', 'line-strong', 'faint'] as const;
type Palette = Record<(typeof TOKENS)[number], string>;

interface Place {
  id: string;
  name: string;
  count: number;
  lat: number;
  lon: number;
  series: string[];
  label: string;
  link: HTMLAnchorElement;
  marker?: Marker;
}

interface Pin {
  element: HTMLElement;
  kind: 'city' | 'place';
  lngLat: [number, number];
  weight: number;
  places: Place[];
  group: Place[];
}

interface City {
  bounds: Bounds;
  name: string;
  label: string;
  count: string;
  places: Place[];
}

const hasWebGL = () => {
  try {
    return !!document.createElement('canvas').getContext('webgl2');
  } catch {
    return false;
  }
};

function palette(probe: HTMLElement): Palette {
  const read = (token: string) => {
    probe.style.color = `var(--yk-${token})`;
    return getComputedStyle(probe).color;
  };
  return Object.fromEntries(TOKENS.map((t) => [t, read(t)])) as Palette;
}

const lngLat = (p: { lat: number; lon: number }): [number, number] => [p.lon, p.lat];

function readPlaces(): City[] {
  return [...document.querySelectorAll<HTMLElement>('[data-city]')].map((el) => {
    const places = [...el.querySelectorAll<HTMLAnchorElement>('[data-place]')].map((link) => ({
      id: link.dataset.place!,
      name: link.dataset.name!,
      count: Number(link.dataset.count),
      lat: Number(link.dataset.lat),
      lon: Number(link.dataset.lon),
      series: link.dataset.series!.split(' '),
      label: link.dataset.label!,
      link,
    }));
    const cut = el.dataset.bounds!.split(' ').map(Number) as Bounds;
    return { bounds: cut, name: el.dataset.name!, label: el.dataset.label!, count: el.dataset.count!, places };
  });
}

function style(c: Palette, lang: string, tiles: string, worldMax: number, cityZooms: number[], regions: City[]): StyleSpecification {
  const name: ExpressionSpecification =
    lang === 'tr' ? ['coalesce', ['get', 'name:tr'], ['get', 'name:en']] : ['get', 'name:en'];
  const cities = regions.map((r, i) => ({ id: `city-${i}`, bounds: r.bounds }));
  const ours = regions.flatMap((r) => [r.name, ...r.places.map((p) => p.name)]);
  const base = (source: string, detail: boolean): LayerSpecification[] => [
    { id: `${source}-earth`, type: 'fill', source, 'source-layer': 'earth', paint: { 'fill-color': c.land } },
    { id: `${source}-water`, type: 'fill', source, 'source-layer': 'water', paint: { 'fill-color': c.ocean } },
    {
      id: `${source}-coast`,
      type: 'line',
      source,
      'source-layer': 'earth',
      paint: { 'line-color': c.coast, 'line-opacity': 0.55, 'line-width': ['interpolate', ['linear'], ['zoom'], 0, 0.4, 12, 1] },
    },
    ...(detail
      ? ([
          {
            id: `${source}-roads`,
            type: 'line',
            source,
            'source-layer': 'roads',
            minzoom: 10,
            filter: ['in', ['get', 'kind'], ['literal', ['minor_road', 'other']]],
            paint: { 'line-color': c.line, 'line-opacity': 0.6, 'line-width': ['interpolate', ['linear'], ['zoom'], 12, 0.5, 16, 3] },
          },
          {
            id: `${source}-roads-major`,
            type: 'line',
            source,
            'source-layer': 'roads',
            minzoom: 8,
            filter: ['in', ['get', 'kind'], ['literal', ['highway', 'major_road', 'medium_road']]],
            paint: { 'line-color': c['line-strong'], 'line-opacity': 0.7, 'line-width': ['interpolate', ['linear'], ['zoom'], 8, 0.4, 16, 3] },
          },
          {
            id: `${source}-buildings`,
            type: 'fill',
            source,
            'source-layer': 'buildings',
            minzoom: 14,
            paint: { 'fill-color': c.line },
          },
        ] satisfies LayerSpecification[])
      : []),
    {
      id: `${source}-borders`,
      type: 'line',
      source,
      'source-layer': 'boundaries',
      filter: ['==', ['get', 'kind'], 'country'],
      paint: { 'line-color': c.frontier, 'line-width': 1 },
    },
  ];
  return {
    version: 8,
    projection: { type: 'globe' },
    sky: { 'atmosphere-blend': 0 },
    glyphs: `${location.origin}${GLYPHS}`,
    sources: {
      world: { type: 'vector', tiles: [`${location.origin}${tiles}`], minzoom: 0, maxzoom: worldMax },
      ...Object.fromEntries(
        cities.map((s) => [
          s.id,
          { type: 'vector', tiles: [`${location.origin}${tiles}`], minzoom: cityZooms[0], maxzoom: cityZooms[1], bounds: s.bounds },
        ]),
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

function markerElement(kind: 'city' | 'place', label: string, name: string, weight: number, count?: string) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'map-marker';
  button.dataset.kind = kind;
  button.dataset.weight = String(weight);
  button.setAttribute('aria-label', label);
  const dot = document.createElement('span');
  dot.className = 'map-dot';
  const text = document.createElement('span');
  text.className = 'map-name';
  text.setAttribute('aria-hidden', 'true');
  text.textContent = name;
  if (count) {
    const n = document.createElement('span');
    n.className = 'map-count';
    n.textContent = count;
    text.append(n);
  }
  button.append(dot, text);
  return button;
}

async function start(frame: HTMLElement) {
  const { maplibre, tiles, lang } = frame.dataset as Record<string, string>;
  const worldMax = Number(frame.dataset.worldMaxZoom);
  const cityZooms = frame.dataset.cityZooms!.split(' ').map(Number);
  const [lon, lat] = frame.dataset.centre!.split(' ').map(Number);
  const canvas = frame.querySelector<HTMLElement>('[data-map-canvas]')!;
  const crumb = frame.querySelector<HTMLElement>('[data-crumb]')!;
  const crumbCity = frame.querySelector<HTMLElement>('[data-crumb-city]')!;
  const cards = new Map([...frame.querySelectorAll<HTMLElement>('[data-card]')].map((c) => [c.dataset.card!, c]));
  const cities = readPlaces();
  const places = cities.flatMap((c) => c.places);
  const wide = matchMedia('(min-width: 48rem)');

  frame.hidden = false;
  const gl: MapLibre = await import(/* @vite-ignore */ new URL(maplibre, location.origin).href);
  const globeZoom = () => Math.log2((0.85 * Math.min(canvas.clientWidth, canvas.clientHeight) * Math.PI) / 512);
  const home = () => ({ center: [lon, lat] as [number, number], zoom: globeZoom() });
  const paint = () => style(palette(frame), lang, tiles, worldMax, cityZooms, cities);

  let map: MapLibreMap;
  try {
    map = new gl.Map({
      container: canvas,
      style: paint(),
      ...home(),
      minZoom: 0,
      maxZoom: 16,
      attributionControl: false,
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false,
      renderWorldCopies: false,
    });
  } catch {
    frame.hidden = true;
    return;
  }
  map.touchZoomRotate.disableRotation();
  map.keyboard.disableRotation();

  let selected: Place | null = null;

  const placeCard = () => {
    if (!selected || !wide.matches) return;
    const card = cards.get(selected.id)!;
    const { x, y } = map.project(lngLat(selected));
    const [w, h] = [card.offsetWidth, card.offsetHeight];
    const [width, height] = [frame.clientWidth, frame.clientHeight];
    const clamp = (v: number, max: number) => Math.min(Math.max(CARD_MARGIN, v), max - CARD_MARGIN);
    let left: number;
    let top: number;
    if (x + CARD_GAP + w <= width - CARD_MARGIN || x - CARD_GAP - w >= CARD_MARGIN) {
      left = x + CARD_GAP + w <= width - CARD_MARGIN ? x + CARD_GAP : x - CARD_GAP - w;
      top = clamp(y - 18, height - h);
    } else {
      left = clamp(x - w / 2, width - w);
      top = y + CARD_GAP + h <= height - CARD_MARGIN ? y + CARD_GAP : y - CARD_GAP - h;
    }
    card.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`;
  };

  const select = (place: Place | null) => {
    if (selected) {
      cards.get(selected.id)!.hidden = true;
      selected.marker?.getElement().setAttribute('aria-pressed', 'false');
    }
    selected = place;
    if (!place) {
      history.replaceState(null, '', location.pathname + location.search);
      return;
    }
    const card = cards.get(place.id)!;
    card.hidden = false;
    place.marker?.getElement().setAttribute('aria-pressed', 'true');
    placeCard();
    history.replaceState(null, '', `#${place.id}`);
  };

  const fly = (options: Parameters<MapLibreMap['flyTo']>[0]) => map.flyTo({ ...options, essential: false });

  const showPlace = (place: Place, animate = true) => {
    select(null);
    map.once('moveend', () => select(place));
    const lift = wide.matches ? 0 : SHEET_LIFT;
    const zoom = Math.max(map.getZoom(), PLACE_ZOOM - 0.5);
    if (animate) fly({ center: lngLat(place), zoom, offset: [0, -lift] });
    else {
      map.jumpTo({ center: lngLat(place), zoom });
      map.panBy([0, lift], { animate: false });
    }
  };

  const showSeries = (id: string, animate = true) => {
    const own = places.filter((p) => p.series.includes(id));
    if (own.length) map.fitBounds(bounds(own), { padding: FIT_PADDING, maxZoom: PLACE_ZOOM, essential: false, animate });
  };

  const fitPlaces = (group: Place[], maxZoom = PLACE_ZOOM) =>
    map.fitBounds(bounds(group), { padding: FIT_PADDING, maxZoom, essential: false });

  const pins: Pin[] = [];
  for (const city of cities) {
    const element = markerElement('city', city.label, city.name, Number(city.count), city.count);
    const pin: Pin = { element, kind: 'city', lngLat: lngLat(boundsMiddle(city.places)), weight: Number(city.count), places: city.places, group: city.places };
    element.addEventListener('click', () => fitPlaces(pin.group));
    new gl.Marker({ element, anchor: 'center', opacityWhenCovered: '0' }).setLngLat(pin.lngLat).addTo(map);
    pins.push(pin);
    for (const place of city.places) {
      const marker = markerElement('place', place.label, place.name, place.count);
      marker.setAttribute('aria-pressed', 'false');
      const own: Pin = { element: marker, kind: 'place', lngLat: lngLat(place), weight: place.count, places: [place], group: [place] };
      marker.addEventListener('click', () => {
        if (own.group.length > 1) fitPlaces(own.group, MERGED_ZOOM);
        else select(selected === place ? null : place);
      });
      place.marker = new gl.Marker({ element: marker, anchor: 'center', opacityWhenCovered: '0' }).setLngLat(lngLat(place)).addTo(map);
      pins.push(own);
      place.link.addEventListener('click', (e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        frame.scrollIntoView({ block: 'nearest', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
        showPlace(place);
      });
    }
  }

  const level = () => {
    const zoom = map.getZoom();
    frame.dataset.level = zoom < CITY_LEVEL ? 'world' : 'city';
    const here = zoom >= CITY_LEVEL - 1 ? cities.find((c) => contains(c.bounds, { lat: map.getCenter().lat, lon: map.getCenter().lng })) : undefined;
    crumb.hidden = !here;
    crumbCity.textContent = here?.name ?? '';
  };
  const declutter = () => {
    const kind = frame.dataset.level === 'world' ? 'city' : 'place';
    const leaders: { pin: Pin; at: { x: number; y: number } }[] = [];
    for (const pin of pins.filter((p) => p.kind === kind).sort((a, b) => b.weight - a.weight)) {
      const at = map.project(pin.lngLat);
      const leader = leaders.find((l) => Math.hypot(l.at.x - at.x, l.at.y - at.y) < MERGE_PX);
      pin.element.toggleAttribute('data-merged', !!leader);
      pin.group = [...pin.places];
      if (leader) leader.pin.group.push(...pin.places);
      else leaders.push({ pin, at });
    }
    const taken = leaders.map(({ at }) => new DOMRect(at.x - 8, at.y - 8, 16, 16));
    const width = frame.clientWidth;
    const clear = (r: DOMRect) =>
      r.left >= 0 && r.right <= width && !taken.some((t) => t.left < r.right && r.left < t.right && t.top < r.bottom && r.top < t.bottom);
    for (const { pin, at } of leaders) {
      const name = pin.element.querySelector<HTMLElement>('.map-name')!;
      const [w, h] = [name.offsetWidth, name.offsetHeight];
      const right = new DOMRect(at.x + LABEL_OFFSET, at.y - h / 2, w, h);
      const left = new DOMRect(at.x - LABEL_OFFSET - w, at.y - h / 2, w, h);
      const spot = [right, left].find(clear);
      pin.element.toggleAttribute('data-quiet', !spot);
      pin.element.toggleAttribute('data-flip', spot === left);
      if (spot) taken.push(spot);
    }
  };
  map.on('zoom', level);
  map.on('moveend', level);
  map.on('moveend', declutter);
  map.on('move', placeCard);
  level();
  declutter();

  frame.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    if (target.closest('[data-close]')) select(null);
    else if (target.closest('[data-world]')) {
      select(null);
      fly(home());
    } else if (target.closest('[data-zoom="in"]')) map.zoomIn();
    else if (target.closest('[data-zoom="out"]')) map.zoomOut();
  });
  frame.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && selected) {
      const marker = selected.marker?.getElement();
      select(null);
      marker?.focus();
    }
  });
  wide.addEventListener('change', placeCard);

  new MutationObserver(() => map.setStyle(paint())).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  const focus = (animate: boolean) => {
    const id = decodeURIComponent(location.hash.slice(1));
    if (!id) return;
    const place = places.find((p) => p.id === id);
    if (place) showPlace(place, animate);
    else showSeries(id, animate);
  };
  addEventListener('hashchange', () => focus(true));
  focus(false);
}

if (frame && hasWebGL()) start(frame);
