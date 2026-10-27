import { getListing, getListings } from '../api.js';
import { SITE, STATUS } from '../config.js';
import { $, $$, esc, fmtPrice, fmtArea, perSot, statusBadge, satFigure, gallery, cardHTML, waLink, centroid } from '../util.js';
import { createMap, addPlots, orbit, flyToListing, set3D, setBase } from '../mapkit.js';

export default async function detail(root, id) {
  const l = await getListing(id);
  if (!l) {
    root.innerHTML = `<section class="container page-head"><h1>Elan tapılmadı</h1><p class="muted">Bu elan silinib və ya kod səhvdir.</p><a class="btn btn-dark" href="#/elanlar">Bütün elanlar</a></section>`;
    return;
  }
  const list = await getListings();
  const similar = list
    .filter((x) => x.id !== l.id && x.status !== 'sold' && (x.region === l.region || x.category === l.category))
    .sort((a, b) => (b.region === l.region) - (a.region === l.region) || Math.abs(a.price - l.price) - Math.abs(b.price - l.price))
    .slice(0, 3);
  const shots = gallery(l);
  const [lon, lat] = centroid(l.polygon);
  const shotHTML = (s, big) =>
    s.type === 'photo'
      ? `<div class="sat"><img src="${esc(s.url)}" alt="${esc(l.title)}" /></div>`
      : satFigure(l, { w: big ? 1200 : 300, h: big ? 760 : 200, pad: s.pad, minSize: s.minSize });

  root.innerHTML = `
  <section class="container detail">
    <nav class="crumbs"><a href="#/">Ana səhifə</a><span>/</span><a href="#/elanlar">Elanlar</a><span>/</span><span>${esc(l.region)}</span></nav>
    <header class="detail-head">
      <div>
        <div class="detail-tags">${statusBadge(l.status)}<span class="badge badge-plain">${esc(l.category)}</span>${l.project ? `<span class="badge badge-plain">${esc(l.project)}</span>` : ''}</div>
        <h1>${esc(l.title)}</h1>
        <p class="muted">${esc(l.region)} rayonu, ${esc(l.settlement)} · Kod: ${l.id}</p>
      </div>
      <div class="detail-price"><strong>${fmtPrice(l.price)}</strong><span>${perSot(l)} / sot</span></div>
    </header>

    <div class="detail-gallery">
      <div class="g-main" id="gMain">${shotHTML(shots[0], true)}<span class="g-label">${shots[0].label || 'Foto'}</span></div>
      <div class="g-thumbs">
        ${shots.map((s, i) => `<button class="g-thumb ${i ? '' : 'active'}" data-i="${i}">${shotHTML(s, false)}<span>${s.label || 'Foto'}</span></button>`).join('')}
      </div>
    </div>

    <div class="detail-grid">
      <div class="detail-main">
        <dl class="specs specs-lg">
          <div><dt>Sahə</dt><dd>${fmtArea(l.area)}${l.area >= 100 ? ` <small>(${l.area} sot)</small>` : ''}</dd></div>
          <div><dt>Qiymət</dt><dd>${fmtPrice(l.price)}</dd></div>
          <div><dt>1 sot</dt><dd>${perSot(l)}</dd></div>
          <div><dt>Təyinat</dt><dd>${esc(l.category)}</dd></div>
          <div><dt>Sənəd</dt><dd>${esc(l.document)}</dd></div>
          <div><dt>Status</dt><dd>${STATUS[l.status].label}</dd></div>
          ${l.distances?.sea != null ? `<div><dt>Dənizə</dt><dd>${l.distances.sea} km</dd></div>` : ''}
          ${l.distances?.city != null ? `<div><dt>Rayon mərkəzinə</dt><dd>${l.distances.city} km</dd></div>` : ''}
        </dl>

        <h2 class="h-sm">Kommunikasiya və üstünlüklər</h2>
        <div class="chips chips-lg">${(l.features || []).map((f) => `<span class="chip-s">✓ ${esc(f)}</span>`).join('') || '<span class="muted">Qeyd olunmayıb</span>'}</div>

        <h2 class="h-sm">Təsvir</h2>
        <div class="prose">${esc(l.description).split(/\n{2,}/).map((p) => `<p>${p.replace(/\n/g, '<br/>')}</p>`).join('')}</div>

        <h2 class="h-sm">Sahə 3D xəritədə</h2>
        <div class="detail-map">
          <div id="dmap" class="map"></div>
          <div class="map-tools map-tools-sm">
            <button class="tool active" id="dOrbit">Fırlanır</button>
            <button class="tool active" id="d3d">3D</button>
            <button class="tool" id="dBase">Peyk</button>
            <a class="tool" href="#/xerite/${l.id}">Böyük xəritə ↗</a>
          </div>
        </div>
        <p class="muted coords">Koordinatlar: ${lat.toFixed(5)}, ${lon.toFixed(5)} ·
          <a href="https://www.google.com/maps?q=${lat},${lon}" target="_blank" rel="noopener">Google Maps-də aç</a></p>
      </div>

      <aside class="detail-side">
        <div class="agent-card">
          <div class="agent">
            <span class="avatar">${esc(SITE.agent.split(' ').map((w) => w[0]).join(''))}</span>
            <div><strong>${esc(SITE.agent)}</strong><span class="muted">${esc(SITE.role)}</span></div>
          </div>
          <a class="btn btn-accent btn-block" href="tel:${SITE.phone.replace(/\s/g, '')}">${esc(SITE.phone)}</a>
          <a class="btn btn-wa btn-block" href="${waLink(l)}" target="_blank" rel="noopener">WhatsApp ilə yaz</a>
          <p class="muted small">${esc(SITE.hours)}. Baxış üçün əvvəlcədən zəng edin.</p>
        </div>
      </aside>
    </div>

    ${similar.length ? `<section class="section-sm"><h2>Oxşar sahələr</h2><div class="grid cards">${similar.map(cardHTML).join('')}</div></section>` : ''}
  </section>`;

  // Qalereya
  $$('.g-thumb', root).forEach((b) => b.addEventListener('click', () => {
    const s = shots[+b.dataset.i];
    $('#gMain').innerHTML = `${shotHTML(s, true)}<span class="g-label">${s.label || 'Foto'}</span>`;
    $$('.g-thumb', root).forEach((x) => x.classList.toggle('active', x === b));
  }));

  // 3D mini xəritə
  const [cx, cy] = centroid(l.polygon);
  const map = createMap($('#dmap'), { center: [cx, cy], zoom: 15, pitch: 60, bearing: 0 });
  map.scrollZoom.disable();
  map.on('click', () => map.scrollZoom.enable());
  const spin = orbit(map, { speed: 5, onStop: () => $('#dOrbit')?.classList.remove('active') });
  map.on('load', () => {
    const plots = addPlots(map, list.filter((x) => x.id === l.id || x.project && x.project === l.project), { markers: false, onSelect: (id) => id !== l.id && (location.hash = `#/elan/${id}`) });
    plots.select(l.id);
    flyToListing(map, l, { padding: 90, duration: 0, extraZoom: l.area > 80 ? -0.3 : -0.1 });
    map.once('idle', () => spin.start());
  });
  $('#dOrbit').addEventListener('click', (e) => e.currentTarget.classList.toggle('active', spin.toggle()));
  $('#d3d').addEventListener('click', (e) => {
    set3D(map, !map._is3d);
    e.currentTarget.classList.toggle('active', map._is3d);
    e.currentTarget.textContent = map._is3d ? '3D' : '2D';
  });
  $('#dBase').addEventListener('click', (e) => {
    setBase(map, map._base === 'satellite' ? 'street' : 'satellite');
    e.currentTarget.textContent = map._base === 'satellite' ? 'Peyk' : 'Xəritə';
  });

  return () => { spin.stop(); map.remove(); };
}
