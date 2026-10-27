// MapLibre əsaslı 3D xəritə: peyk görüntüsü + relyef + torpaq sahələrinin poliqonları
import { STATUS, AZ_VIEW } from './config.js';
import { centroid, bounds, fmtShort, fmtArea, fmtPrice, esc } from './util.js';

const ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services';
const DEM = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png';
export const EXAGGERATION = 1.25;

export function mapStyle(base = 'satellite') {
  const vis = (on) => ({ visibility: on ? 'visible' : 'none' });
  const sat = base === 'satellite';
  return {
    version: 8,
    sources: {
      sat: { type: 'raster', tiles: [`${ESRI}/World_Imagery/MapServer/tile/{z}/{y}/{x}`], tileSize: 256, maxzoom: 18, attribution: 'Peyk: © Esri, Maxar, Earthstar Geographics' },
      ref: { type: 'raster', tiles: [`${ESRI}/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}`], tileSize: 256, maxzoom: 19 },
      roads: { type: 'raster', tiles: [`${ESRI}/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}`], tileSize: 256, maxzoom: 19 },
      street: { type: 'raster', tiles: [`${ESRI}/World_Street_Map/MapServer/tile/{z}/{y}/{x}`], tileSize: 256, maxzoom: 19, attribution: '© Esri, HERE, Garmin, OpenStreetMap' },
      dem: { type: 'raster-dem', tiles: [DEM], tileSize: 256, encoding: 'terrarium', maxzoom: 14, attribution: 'Relyef: Mapzen, AWS' },
      hs: { type: 'raster-dem', tiles: [DEM], tileSize: 256, encoding: 'terrarium', maxzoom: 14 },
    },
    layers: [
      { id: 'bg', type: 'background', paint: { 'background-color': '#0e1a14' } },
      { id: 'street', type: 'raster', source: 'street', layout: vis(!sat) },
      { id: 'sat', type: 'raster', source: 'sat', layout: vis(sat), paint: { 'raster-contrast': 0.06, 'raster-saturation': 0.08 } },
      { id: 'hillshade', type: 'hillshade', source: 'hs', layout: vis(!sat), paint: { 'hillshade-exaggeration': 0.35, 'hillshade-shadow-color': '#46503f' } },
      { id: 'roads', type: 'raster', source: 'roads', minzoom: 11, layout: vis(sat), paint: { 'raster-opacity': 0.5 } },
      { id: 'ref', type: 'raster', source: 'ref', layout: vis(sat), paint: { 'raster-opacity': 0.9 } },
    ],
    sky: {
      'sky-color': '#6a9fd8',
      'horizon-color': '#dfe9f2',
      'fog-color': '#e8eef2',
      'sky-horizon-blend': 0.55,
      'horizon-fog-blend': 0.7,
      'fog-ground-blend': 0.35,
      'atmosphere-blend': ['interpolate', ['linear'], ['zoom'], 0, 1, 10, 1, 13, 0.2],
    },
    terrain: { source: 'dem', exaggeration: EXAGGERATION },
  };
}

export function createMap(container, opts = {}) {
  const { base = 'satellite', interactive = true, nav = true, ...view } = opts;
  const map = new maplibregl.Map({
    container,
    style: mapStyle(base),
    ...AZ_VIEW,
    ...view,
    maxPitch: 78,
    interactive,
    attributionControl: { compact: true },
    cooperativeGestures: false,
  });
  if (interactive && nav) map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'bottom-right');
  map._base = base;
  map._is3d = true;
  // Konteynerin ölçüsü dəyişəndə (şriftlər, panel, scrollbar) kətanı yenilə
  const ro = new ResizeObserver(() => map.getCanvas() && map.resize());
  ro.observe(map.getContainer());
  map.on('remove', () => ro.disconnect());
  // Relyef plitələri gec yüklənəndə kameranın mərkəz hündürlüyünü yenilə (dağlıq ərazidə kamera relyefin içinə düşməsin)
  map.on('idle', () => {
    if (!map.getTerrain()) return;
    const t = map.queryTerrainElevation(map.getCenter());
    if (t != null && Math.abs(t - map.getCenterElevation()) > 30) map.jumpTo({ elevation: t });
  });
  return map;
}

export function setBase(map, base) {
  const sat = base === 'satellite';
  for (const id of ['sat', 'roads', 'ref']) map.setLayoutProperty(id, 'visibility', sat ? 'visible' : 'none');
  for (const id of ['street', 'hillshade']) map.setLayoutProperty(id, 'visibility', sat ? 'none' : 'visible');
  map._base = base;
}

export function set3D(map, on) {
  map._is3d = on;
  map.setTerrain(on ? { source: 'dem', exaggeration: EXAGGERATION } : null);
  if (map.getLayer('plots-3d')) map.setLayoutProperty('plots-3d', 'visibility', on ? 'visible' : 'none');
  map.easeTo({ pitch: on ? 60 : 0, bearing: on ? map.getBearing() : 0, duration: 1200 });
}

// Yavaş fırlanma (orbit) — istifadəçi xəritəyə toxunduqda dayanır
export function orbit(map, { speed = 3, stopOnInteract = true, onStop } = {}) {
  let raf = 0, last = 0, running = false;
  const step = (t) => {
    if (last) map.setBearing(map.getBearing() + ((t - last) / 1000) * speed);
    last = t;
    raf = requestAnimationFrame(step);
  };
  const ctl = {
    get running() { return running; },
    start() { if (running) return; running = true; last = 0; raf = requestAnimationFrame(step); },
    stop() { if (!running) return; running = false; cancelAnimationFrame(raf); onStop?.(); },
    toggle() { running ? ctl.stop() : ctl.start(); return running; },
  };
  if (stopOnInteract) ['mousedown', 'touchstart', 'wheel'].forEach((ev) => map.on(ev, () => ctl.stop()));
  return ctl;
}

// Nöqtənin real hündürlüyü (m) — Terrarium relyef plitəsindən oxunur.
// Kamera uçuşdan əvvəl hədəfin hündürlüyünü bilməlidir, əks halda dağlıq yerlərdə relyefin içinə düşür.
const elevCache = new Map();
export async function getElevation([lng, lat], z = 12) {
  const n = 2 ** z;
  const xf = ((lng + 180) / 360) * n;
  const yf = ((1 - Math.log(Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)) / Math.PI) / 2) * n;
  const [x, y] = [Math.floor(xf), Math.floor(yf)];
  const key = `${z}/${x}/${y}`;
  if (!elevCache.has(key)) {
    elevCache.set(key, (async () => {
      const blob = await (await fetch(DEM.replace('{z}', z).replace('{x}', x).replace('{y}', y))).blob();
      const bmp = await createImageBitmap(blob);
      const c = new OffscreenCanvas(256, 256);
      const ctx = c.getContext('2d');
      ctx.drawImage(bmp, 0, 0);
      return ctx.getImageData(0, 0, 256, 256).data;
    })().catch(() => null));
  }
  const px = await elevCache.get(key);
  if (!px) return 0;
  const i = (Math.min(255, Math.floor((yf - y) * 256)) * 256 + Math.min(255, Math.floor((xf - x) * 256))) * 4;
  return Math.max(0, px[i] * 256 + px[i + 1] + px[i + 2] / 256 - 32768);
}

export async function flyToListing(map, l, { pitch = 62, padding = 80, duration = 2400, extraZoom = -0.4, bearing } = {}) {
  const bb = bounds(l.polygon);
  // cameraForBounds xəritənin mövcud padding-ini öz üzərinə əlavə edir — ikiqat saymamaq üçün yalnız fərqi veririk
  const cur = map.getPadding();
  const fit = typeof padding === 'object'
    ? Object.fromEntries(['top', 'bottom', 'left', 'right'].map((k) => [k, Math.max(0, (padding[k] || 0) - (cur[k] || 0))]))
    : padding;
  const cam = map.cameraForBounds([[bb[0], bb[1]], [bb[2], bb[3]]], { padding: fit, bearing: bearing ?? map.getBearing() });
  if (!cam) return;
  const is3d = map._is3d !== false;
  const target = is3d ? pitch : 0;
  const elev = is3d ? getElevation(centroid(l.polygon)) : null;
  // Uçuş zamanı hədəfin relyefi hələ yüklənməyib — sonda hündürlüyü düzəldib bucağı bərpa edirik
  // (duration: 0 olanda moveend dərhal gəlir, ona görə dinləyici flyTo-dan əvvəl qoşulur)
  if (is3d) map.once('moveend', async () => {
    const elevation = map.queryTerrainElevation(map.getCenter()) ?? (await elev) * EXAGGERATION;
    map.jumpTo({ elevation });
    if (Math.abs(map.getPitch() - target) > 1) map.easeTo({ pitch: target, duration: 900 });
  });
  map.flyTo({
    center: cam.center,
    zoom: Math.min(cam.zoom + extraZoom, 18.2),
    pitch: target,
    bearing: bearing ?? map.getBearing(),
    duration,
    essential: true,
    padding: typeof padding === 'object' ? padding : undefined,
  });
}

export function fitListings(map, list, { padding = 60, duration = 1600 } = {}) {
  if (!list.length) return;
  const all = list.flatMap((l) => l.polygon);
  const b = bounds(all);
  map.fitBounds([[b[0], b[1]], [b[2], b[3]]], { padding, duration, maxZoom: 15, pitch: map._is3d === false ? 0 : 45 });
}

const toGeoJSON = (list) => ({
  type: 'FeatureCollection',
  features: list.map((l) => ({
    type: 'Feature',
    properties: { id: l.id, status: l.status, color: STATUS[l.status]?.color || '#fff', price: l.price, title: l.title, area: l.area },
    geometry: { type: 'Polygon', coordinates: [l.polygon] },
  })),
});

const toPoints = (list) => ({
  type: 'FeatureCollection',
  features: list.map((l) => ({
    type: 'Feature',
    properties: { id: l.id, status: l.status, price: l.price },
    geometry: { type: 'Point', coordinates: centroid(l.polygon) },
  })),
});

/**
 * Sahələri xəritəyə əlavə edir. Qaytarır: { setData, select, hover }
 */
export function addPlots(map, list, { onSelect, markers = true, tooltip = true } = {}) {
  let data = list;
  let selected = null;
  let hovered = null;

  map.addSource('plots', { type: 'geojson', data: toGeoJSON(list), promoteId: 'id' });
  map.addLayer({
    id: 'plots-fill',
    type: 'fill',
    source: 'plots',
    paint: {
      'fill-color': ['get', 'color'],
      'fill-opacity': ['case', ['boolean', ['feature-state', 'selected'], false], 0.6, ['boolean', ['feature-state', 'hover'], false], 0.5, 0.3],
    },
  });
  map.addLayer({
    id: 'plots-3d',
    type: 'fill-extrusion',
    source: 'plots',
    minzoom: 14,
    layout: { visibility: map._is3d === false ? 'none' : 'visible' },
    paint: {
      'fill-extrusion-color': ['get', 'color'],
      'fill-extrusion-height': ['case', ['boolean', ['feature-state', 'selected'], false], 6, ['boolean', ['feature-state', 'hover'], false], 4, 1.6],
      'fill-extrusion-opacity': 0.55,
    },
  });
  map.addLayer({
    id: 'plots-line',
    type: 'line',
    source: 'plots',
    paint: {
      'line-color': ['case', ['boolean', ['feature-state', 'selected'], false], '#ffffff', ['get', 'color']],
      'line-width': ['interpolate', ['linear'], ['zoom'], 8, 1, 14, 2, 18, ['case', ['boolean', ['feature-state', 'selected'], false], 5, 3]],
    },
  });

  // Klasterlər və qiymət nişanları
  map.addSource('plot-points', { type: 'geojson', data: toPoints(list), cluster: true, clusterRadius: 46, clusterMaxZoom: 13 });
  map.addLayer({ id: 'plot-points-hidden', type: 'circle', source: 'plot-points', paint: { 'circle-radius': 0, 'circle-opacity': 0 } });

  const live = new Map();
  function updateMarkers() {
    if (!markers || !map.getSource('plot-points') || !map.isSourceLoaded('plot-points')) return;
    const next = new Map();
    const zoom = map.getZoom();
    for (const f of map.querySourceFeatures('plot-points')) {
      const p = f.properties;
      const key = p.cluster ? `c${p.cluster_id}` : `p${p.id}`;
      if (next.has(key)) continue;
      let m = live.get(key);
      if (!m) {
        const el = document.createElement('div');
        if (p.cluster) {
          const n = p.point_count;
          el.className = 'mk-cluster';
          el.style.setProperty('--s', `${Math.min(64, 34 + n * 1.6)}px`);
          el.innerHTML = `<span>${n}</span><small>sahə</small>`;
          el.addEventListener('click', async (e) => {
            e.stopPropagation();
            const z = await map.getSource('plot-points').getClusterExpansionZoom(p.cluster_id);
            map.easeTo({ center: f.geometry.coordinates, zoom: z + 0.5, duration: 900 });
          });
        } else {
          el.className = `mk-price mk-${p.status}`;
          el.dataset.id = p.id;
          el.innerHTML = `<i></i>${fmtShort(p.price)}`;
          el.addEventListener('click', (e) => { e.stopPropagation(); onSelect?.(p.id); });
          el.addEventListener('mouseenter', () => setHover(p.id));
          el.addEventListener('mouseleave', () => setHover(null));
        }
        m = new maplibregl.Marker({ element: el, anchor: p.cluster ? 'center' : 'bottom', offset: p.cluster ? [0, 0] : [0, -18] }).setLngLat(f.geometry.coordinates).addTo(map);
      }
      m.getElement().classList.toggle('is-selected', !p.cluster && p.id === selected);
      m.getElement().classList.toggle('is-small', zoom > 16.2);
      next.set(key, m);
    }
    for (const [k, m] of live) if (!next.has(k)) m.remove();
    live.clear();
    for (const [k, m] of next) live.set(k, m);
  }
  map.on('render', updateMarkers);

  function setHover(id) {
    if (hovered) map.setFeatureState({ source: 'plots', id: hovered }, { hover: false });
    hovered = id;
    if (id) map.setFeatureState({ source: 'plots', id }, { hover: true });
  }

  const popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 12, className: 'plot-tip' });
  map.on('mousemove', 'plots-fill', (e) => {
    const f = e.features[0];
    map.getCanvas().style.cursor = 'pointer';
    if (hovered !== f.properties.id) setHover(f.properties.id);
    if (tooltip) {
      const p = f.properties;
      popup.setLngLat(e.lngLat).setHTML(`<strong>${esc(p.title)}</strong><div>${fmtArea(+p.area)} · ${fmtPrice(+p.price)}</div><em style="color:${p.color}">${STATUS[p.status].label}</em>`).addTo(map);
    }
  });
  map.on('mouseleave', 'plots-fill', () => {
    map.getCanvas().style.cursor = '';
    setHover(null);
    popup.remove();
  });
  map.on('click', 'plots-fill', (e) => onSelect?.(e.features[0].properties.id));

  return {
    setData(list) {
      data = list;
      map.getSource('plots')?.setData(toGeoJSON(list));
      map.getSource('plot-points')?.setData(toPoints(list));
      if (selected && !list.some((l) => l.id === selected)) this.select(null);
    },
    select(id) {
      if (selected) map.setFeatureState({ source: 'plots', id: selected }, { selected: false });
      selected = id;
      if (id) map.setFeatureState({ source: 'plots', id }, { selected: true });
      updateMarkers();
    },
    hover: setHover,
    get data() { return data; },
  };
}
