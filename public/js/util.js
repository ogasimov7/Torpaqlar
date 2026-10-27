import { STATUS, SITE } from './config.js';

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export const esc = (s = '') =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const fmtNum = (n) => Math.round(n).toLocaleString('ru-RU').replace(/,/g, ' ');
export const fmtPrice = (n) => `${fmtNum(n)} ₼`;
export const fmtShort = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(n % 1e6 ? 1 : 0)}M ₼` : n >= 1e3 ? `${Math.round(n / 1e3)}K ₼` : `${n} ₼`);
export const fmtArea = (sot) => (sot >= 100 ? `${(sot / 100).toLocaleString('az', { maximumFractionDigits: 2 })} ha` : `${sot.toLocaleString('az')} sot`);
export const perSot = (l) => fmtPrice(l.price / l.area);

export const statusBadge = (s) => `<span class="badge badge-${s}"><i></i>${STATUS[s]?.label || s}</span>`;

export const waLink = (l) =>
  `https://wa.me/${SITE.whatsapp}?text=${encodeURIComponent(
    l ? `Salam! "${l.title}" (kod: ${l.id}) elanı ilə maraqlanıram.` : 'Salam! Torpaq sahəsi ilə maraqlanıram.'
  )}`;

// --- Geometriya ---
export function bounds(ring) {
  let [minX, minY, maxX, maxY] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const [x, y] of ring) {
    if (x < minX) minX = x; if (y < minY) minY = y;
    if (x > maxX) maxX = x; if (y > maxY) maxY = y;
  }
  return [minX, minY, maxX, maxY];
}

export function centroid(ring) {
  const pts = ring.length > 1 && ring[0][0] === ring.at(-1)[0] && ring[0][1] === ring.at(-1)[1] ? ring.slice(0, -1) : ring;
  const sum = pts.reduce((a, p) => [a[0] + p[0], a[1] + p[1]], [0, 0]);
  return [sum[0] / pts.length, sum[1] / pts.length];
}

// Poliqonun sahəsi sot ilə (1 sot = 100 m²)
export function areaSot(ring) {
  if (ring.length < 3) return 0;
  const [, lat0] = centroid(ring);
  const kx = 111320 * Math.cos((lat0 * Math.PI) / 180), ky = 110540;
  let a = 0;
  for (let i = 0; i < ring.length; i++) {
    const [x1, y1] = ring[i], [x2, y2] = ring[(i + 1) % ring.length];
    a += x1 * kx * (y2 * ky) - x2 * kx * (y1 * ky);
  }
  return Math.abs(a / 2) / 100;
}

// --- Peyk şəkli (Esri World Imagery) + sahə konturu ---
const R = 6378137;
const merc = ([lon, lat]) => [(R * lon * Math.PI) / 180, R * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360))];

export function satImage(ring, { w = 800, h = 540, pad = 2, minSize = 90 } = {}) {
  const pts = ring.map(merc);
  const [x0, y0, x1, y1] = bounds(pts);
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  let bw = Math.max((x1 - x0) * pad, minSize), bh = Math.max((y1 - y0) * pad, minSize);
  const asp = w / h;
  if (bw / bh > asp) bh = bw / asp; else bw = bh * asp;
  const b = [cx - bw / 2, cy - bh / 2, cx + bw / 2, cy + bh / 2];
  // Esri export ~0.8 m/pikseldən daha yaxın miqyası qəbul etmir — belə halda şəkli kiçik istəyib CSS ilə böyüdürük
  const k = Math.min(1, bw / (w * 0.8));
  const url = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export?bbox=${b
    .map((v) => v.toFixed(1))
    .join(',')}&bboxSR=3857&imageSR=3857&size=${Math.round(w * k)},${Math.round(h * k)}&format=jpg&f=image`;
  const path = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${(((x - b[0]) / bw) * w).toFixed(1)},${(((b[3] - y) / bh) * h).toFixed(1)}`).join('') + 'Z';
  return { url, path, w, h };
}

export function satFigure(l, opts = {}, cls = '') {
  const s = satImage(l.polygon, opts);
  const color = STATUS[l.status]?.color || '#fff';
  return `<div class="sat ${cls}">
    <img src="${s.url}" alt="${esc(l.title)} — peyk görüntüsü" loading="lazy" />
    <svg viewBox="0 0 ${s.w} ${s.h}" preserveAspectRatio="xMidYMid slice"><path d="${s.path}" style="--c:${color}" /></svg>
  </div>`;
}

// Elanın şəkil qalereyası: yüklənmiş fotolar + müxtəlif miqyasda peyk görüntüləri
export function gallery(l) {
  const sat = [
    { pad: 1.8, label: 'Sahə yaxından' },
    { pad: 6, label: 'Ətraf ərazi', minSize: 400 },
    { pad: 22, label: 'Ümumi mövqe', minSize: 2500 },
  ].map((o) => ({ type: 'sat', ...o }));
  return [...(l.photos || []).map((url) => ({ type: 'photo', url })), ...sat];
}

export function coverHTML(l, opts) {
  return l.photos?.length
    ? `<div class="sat"><img src="${esc(l.photos[0])}" alt="${esc(l.title)}" loading="lazy" /></div>`
    : satFigure(l, opts);
}

// Kiçik xətti ikonlar
const ICONS = {
  pin: '<path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21Z"/><circle cx="12" cy="9.5" r="2.5"/>',
  area: '<path d="M4 8V4h4M16 4h4v4M20 16v4h-4M8 20H4v-4"/>',
  tag: '<path d="M3 12V4h8l9 9-8 8-9-9Z"/><circle cx="7.5" cy="8.5" r="1.3"/>',
  doc: '<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5M10 13h6M10 17h6"/>',
  arrow: '<path d="m9 6 6 6-6 6"/>',
};
export const icon = (name, size = 14) =>
  `<svg class="ic" viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`;

const isNew = (l) => Date.now() - new Date(l.createdAt) < 14 * 864e5;

export function cardHTML(l) {
  return `<a class="card" href="#/elan/${l.id}" data-id="${l.id}">
    <div class="card-media">
      ${coverHTML(l, { w: 640, h: 440, pad: 2.2 })}
      <div class="card-tags">${statusBadge(l.status)}</div>
      ${l.featured ? '<span class="card-flag">Seçilmiş</span>' : isNew(l) ? '<span class="card-flag">Yeni</span>' : ''}
    </div>
    <div class="card-body">
      <h3>${esc(l.title)}</h3>
      <div class="card-loc">${icon('pin')}${esc(l.settlement)}, ${esc(l.region)}</div>
      <div class="card-meta"><span>${icon('area')}${fmtArea(l.area)}</span><span>${icon('tag')}${esc(l.category)}</span></div>
      <div class="card-foot">
        <span><strong class="price">${fmtPrice(l.price)}</strong> <small class="per-sot">${perSot(l)}/sot</small></span>
        <span class="btn btn-xs btn-outline">Ətraflı</span>
      </div>
    </div>
  </a>`;
}

// --- Filtrlər (kataloq və xəritə üçün ortaq) ---
export const filters = {
  q: '', region: '', category: '', status: ['available', 'reserved'], minPrice: '', maxPrice: '', minArea: '', maxArea: '', sort: 'new',
};

export function applyFilters(list, f = filters) {
  const q = f.q.trim().toLowerCase();
  const out = list.filter((l) =>
    (!q || `${l.title} ${l.region} ${l.settlement} ${l.id}`.toLowerCase().includes(q)) &&
    (!f.region || l.region === f.region) &&
    (!f.category || l.category === f.category) &&
    (!f.status.length || f.status.includes(l.status)) &&
    (!f.minPrice || l.price >= +f.minPrice) &&
    (!f.maxPrice || l.price <= +f.maxPrice) &&
    (!f.minArea || l.area >= +f.minArea) &&
    (!f.maxArea || l.area <= +f.maxArea)
  );
  const sorters = {
    new: (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
    priceAsc: (a, b) => a.price - b.price,
    priceDesc: (a, b) => b.price - a.price,
    areaDesc: (a, b) => b.area - a.area,
    perSot: (a, b) => a.price / a.area - b.price / b.area,
  };
  return out.sort(sorters[f.sort] || sorters.new);
}

// Filtr sahələri ayrı-ayrı — kataloq və xəritə onları fərqli düzür
export function filterFields(list) {
  const regions = [...new Set(list.map((l) => l.region))].sort((a, b) => a.localeCompare(b, 'az'));
  const cats = [...new Set(list.map((l) => l.category))];
  const f = filters;
  const opt = (v, cur, label = v) => `<option value="${esc(v)}" ${v === cur ? 'selected' : ''}>${esc(label)}</option>`;
  return {
    search: `<label class="f-search"><svg viewBox="0 0 24 24" width="18" height="18"><circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" stroke-width="2"/><path d="m20 20-4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
      <input name="q" type="search" placeholder="Kənd, rayon və ya elan kodu" value="${esc(f.q)}" /></label>`,
    region: `<select name="region"><option value="">Bütün bölgələr</option>${regions.map((r) => opt(r, f.region)).join('')}</select>`,
    category: `<select name="category"><option value="">Bütün təyinatlar</option>${cats.map((c) => opt(c, f.category)).join('')}</select>`,
    price: `<div class="f-range"><input name="minPrice" type="number" min="0" step="1000" placeholder="Qiymət, min ₼" value="${f.minPrice}" /><input name="maxPrice" type="number" min="0" step="1000" placeholder="max ₼" value="${f.maxPrice}" /></div>`,
    area: `<div class="f-range"><input name="minArea" type="number" min="0" placeholder="Sahə, min sot" value="${f.minArea}" /><input name="maxArea" type="number" min="0" placeholder="max sot" value="${f.maxArea}" /></div>`,
    status: `<div class="f-status">${Object.entries(STATUS)
      .map(([k, v]) => `<label class="chip"><input type="checkbox" name="status" value="${k}" ${f.status.includes(k) ? 'checked' : ''}/><span><i style="background:${v.color}"></i>${v.label}</span></label>`)
      .join('')}</div>`,
    sort: `<select name="sort">
      ${opt('new', f.sort, 'Ən yenilər')}${opt('priceAsc', f.sort, 'Ucuzdan bahaya')}${opt('priceDesc', f.sort, 'Bahadan ucuza')}${opt('areaDesc', f.sort, 'Sahəsi böyük')}${opt('perSot', f.sort, '1 sot ən ucuz')}
    </select>`,
    reset: '<button type="reset" class="btn btn-ghost btn-sm f-reset">Sıfırla</button>',
  };
}

export function filtersHTML(list, { compact = false } = {}) {
  const x = filterFields(list);
  return `<form class="filters ${compact ? 'compact' : ''}" autocomplete="off">
    ${x.search}${x.region}${x.category}${x.price}${x.area}${x.status}${x.sort}${x.reset}
  </form>`;
}

export function bindFilters(form, onChange) {
  const read = () => {
    const d = new FormData(form);
    for (const k of ['q', 'region', 'category', 'minPrice', 'maxPrice', 'minArea', 'maxArea', 'sort']) filters[k] = d.get(k) || (k === 'sort' ? 'new' : '');
    filters.status = d.getAll('status');
    onChange();
  };
  form.addEventListener('input', read);
  form.addEventListener('change', read);
  form.addEventListener('submit', (e) => e.preventDefault());
  form.addEventListener('reset', () => setTimeout(() => {
    Object.assign(filters, { q: '', region: '', category: '', status: ['available', 'reserved'], minPrice: '', maxPrice: '', minArea: '', maxArea: '', sort: 'new' });
    $$('input[name=status]', form).forEach((c) => (c.checked = filters.status.includes(c.value)));
    onChange();
  }));
}

export function toast(msg, type = 'ok') {
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  t.textContent = msg;
  document.body.appendChild(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 2600);
}
