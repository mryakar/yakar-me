import type { Map as MapLibreMap, Marker } from 'maplibre-gl';
import { fragmentId } from '../lib/fragment';
import { bounds, contains, type Bounds } from '../lib/map';
import { mapStyle, PALETTE_TOKENS, type Palette } from '../lib/map-style';
import { arrange } from '../lib/map-labels';

type MapLibre = typeof import('maplibre-gl');

const frame = document.querySelector<HTMLElement>('[data-map]');

const CITY_LEVEL = 8;
const PLACE_ZOOM = 13;
const MERGED_ZOOM = 15;
const CARD_GAP = 24;
const SHEET_LIFT = 110;
const CARD_MARGIN = 12;
const FIT_PADDING = 64;

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
  lat: number;
  lon: number;
  name: string;
  label: string;
  count: number;
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
  return Object.fromEntries(PALETTE_TOKENS.map((t) => [t, read(t)])) as Palette;
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
    return {
      bounds: cut,
      lat: Number(el.dataset.lat),
      lon: Number(el.dataset.lon),
      name: el.dataset.name!,
      label: el.dataset.label!,
      count: Number(el.dataset.count),
      places,
    };
  });
}

function markerElement(kind: 'city' | 'place', label: string, name: string, weight: number) {
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
  if (kind === 'city') {
    const n = document.createElement('span');
    n.className = 'map-count';
    n.textContent = String(weight);
    text.append(n);
  }
  button.append(dot, text);
  return button;
}

async function start(frame: HTMLElement) {
  const { maplibre, tiles, lang } = frame.dataset as Record<string, string>;
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
  const paint = () =>
    mapStyle({
      palette: palette(frame),
      lang,
      origin: location.origin,
      tiles,
      worldMaxZoom: Number(frame.dataset.worldMaxZoom),
      cityZooms: frame.dataset.cityZooms!.split(' ').map(Number),
      regions: cities.map((c) => c.bounds),
      ours: cities.flatMap((c) => [c.name, ...c.places.map((p) => p.name)]),
    });

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
    const element = markerElement('city', city.label, city.name, city.count);
    const pin: Pin = { element, kind: 'city', lngLat: lngLat(city), weight: city.count, places: city.places, group: city.places };
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
    const shown = pins.filter((p) => p.kind === kind);
    for (const pin of shown) {
      pin.element.removeAttribute('data-merged');
      pin.group = [...pin.places];
    }
    const layout = arrange(
      shown.map((pin) => {
        const { x, y } = map.project(pin.lngLat);
        const name = pin.element.querySelector<HTMLElement>('.map-name')!;
        return { x, y, weight: pin.weight, width: name.offsetWidth, height: name.offsetHeight };
      }),
      frame.clientWidth,
    );
    shown.forEach((pin, i) => {
      const { leader, side } = layout[i];
      if (leader !== i) shown[leader].group.push(...pin.places);
      pin.element.toggleAttribute('data-merged', leader !== i);
      pin.element.toggleAttribute('data-quiet', leader === i && !side);
      pin.element.toggleAttribute('data-flip', side === 'left');
    });
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
    const id = fragmentId(location.hash);
    if (!id) return;
    const place = places.find((p) => p.id === id);
    if (place) showPlace(place, animate);
    else showSeries(id, animate);
  };
  addEventListener('hashchange', () => focus(true));
  focus(false);
}

if (frame && hasWebGL()) start(frame);
