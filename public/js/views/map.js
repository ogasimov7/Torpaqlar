import { getListings } from '../api.js';
import { STATUS, AZ_VIEW } from '../config.js';
import { $, $$, esc, filterFields, bindFilters, filters, applyFilters, fmtPrice, fmtArea, perSot, statusBadge, coverHTML, waLink } from '../util.js';
import { createMap, addPlots, setBase, set3D, orbit, flyToListing, fitListings } from '../mapkit.js';

const ICON = {
  cube: '<path d="M12 2 3 7v10l9 5 9-5V7l-9-5Zm0 0v20M3 7l9 5 9-5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/>',
  layers: '<path d="m12 3 9 5-9 5-9-5 9-5Zm-9 9 9 5 9-5M3 16l9 5 9-5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/>',
  rotate: '<path d="M20 12a8 8 0 1 1-2.3-5.6M20 4v5h-5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
  home: '<path d="M4 11 12 4l8 7v9h-5v-6H9v6H4v-9Z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  sliders: '<path d="M4 7h10M18 7h2M4 17h4M12 17h8" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/><circle cx="16" cy="7" r="2.2" fill="none" stroke="currentColor" stroke-width="1.9"/><circle cx="10" cy="17" r="2.2" fill="none" stroke="currentColor" stroke-width="1.9"/>',
};
const ic = (n) => `<svg viewBox="0 0 24 24" width="18" height="18">${ICON[n]}</svg>`;

export default async function mapView(root, initialId) {
  const list = await getListings();
  const F = filterFields(list);
  root.innerHTML = `
  <div class="map-layout">
    <aside class="map-panel" id="panel">
      <div class="panel-head">
        <strong id="countM"></strong>
        <button class="icon-btn panel-close" id="panelClose" aria-label="Bağla">✕</button>
      </div>
      <div class="panel-list" id="plist"></div>
    </aside>
    <div class="map-wrap" id="mapWrap">
      <div id="map" class="map"></div>
      <div class="map-top">
        <button class="map-fbtn" id="fOpen" aria-haspopup="dialog">${ic('sliders')}<span>Filtrlər</span><b class="mf-badge" id="mfBadge"></b></button>
        <div class="map-tools">
          <button class="tool active" id="t3d" title="3D / 2D">${ic('cube')}<span>3D</span></button>
          <button class="tool" id="tBase" title="Peyk / Xəritə">${ic('layers')}<span>Peyk</span></button>
          <button class="tool" id="tOrbit" title="Fırlat">${ic('rotate')}<span>Fırlat</span></button>
          <button class="tool" id="tHome" title="Bütün sahələr">${ic('home')}<span>Hamısı</span></button>
        </div>
      </div>
      <button class="tool tool-list" id="tList">${ic('list')}<span>Siyahı</span></button>
      <div class="map-legend">${Object.values(STATUS).map((s) => `<span><i style="background:${s.color}"></i>${s.label}</span>`).join('')}</div>
      <article class="drawer" id="drawer" aria-hidden="true"></article>
    </div>
    <div class="fmodal" id="fmodal" aria-hidden="true">
      <div class="fmodal-back" data-close></div>
      <form class="fmodal-card" id="mf" role="dialog" aria-modal="true" aria-labelledby="fmTitle" autocomplete="off" tabindex="-1">
        <header class="fm-head"><h2 id="fmTitle">Filtrlər</h2><button type="button" class="icon-btn" data-close aria-label="Bağla">✕</button></header>
        <div class="fm-body">
          <div class="fm-field"><span>Axtarış</span>${F.search}</div>
          <div class="fm-grid">
            <label class="fm-field"><span>Bölgə</span>${F.region}</label>
            <label class="fm-field"><span>Təyinat</span>${F.category}</label>
          </div>
          <div class="fm-field"><span>Status</span>${F.status}</div>
          <div class="fm-field"><span>Qiymət, ₼</span>${F.price}</div>
          <div class="fm-field"><span>Sahə, sot</span>${F.area}</div>
          <label class="fm-field"><span>Sıralama</span>${F.sort}</label>
        </div>
        <footer class="fm-foot">${F.reset}<button type="button" class="btn btn-dark" data-close id="fmApply"></button></footer>
      </form>
    </div>
  </div>`;

  const map = createMap($('#map'), { ...AZ_VIEW });
  const panel = $('#panel');
  const drawer = $('#drawer');
  let plots, current = null, filtered = applyFilters(list);
  const spin = orbit(map, { speed: 4, onStop: () => $('#tOrbit')?.classList.remove('active') });

  const mf = $('#mf');
  const fmodal = $('#fmodal');
  const drawerPad = () => {
    const top = 90;
    if (!current) return { top, bottom: 70, left: 60, right: 60 };
    return window.innerWidth > 900
      ? { top, bottom: 60, left: 60, right: 450 }
      : { top, bottom: Math.round(window.innerHeight * 0.5) + 20, left: 30, right: 30 };
  };

  function drawList() {
    $('#countM').textContent = `${filtered.length} sahə`;
    $('#fmApply').textContent = filtered.length ? `${filtered.length} sahəni göstər` : 'Uyğun sahə yoxdur';
    // Neçə filtr aktivdir (standart vəziyyətdən fərqlənənlər)
    const active = ['q', 'region', 'category', 'minPrice', 'maxPrice', 'minArea', 'maxArea'].filter((k) => String(filters[k]).trim()).length
      + (filters.sort !== 'new') + (filters.status.slice().sort().join() !== 'available,reserved');
    $('#mfBadge').textContent = active || '';
    $('#fOpen').classList.toggle('has', active > 0);
    $('#plist').innerHTML = filtered.length
      ? filtered.map((l) => `
        <button class="mini ${l.id === current?.id ? 'active' : ''}" data-id="${l.id}">
          <div class="mini-img">${coverHTML(l, { w: 200, h: 150, pad: 2.2 })}</div>
          <div class="mini-body">
            <div class="mini-loc">${esc(l.region)} · ${esc(l.settlement)}</div>
            <strong>${esc(l.title)}</strong>
            <div class="mini-meta"><span class="price">${fmtPrice(l.price)}</span><span>${fmtArea(l.area)}</span></div>
          </div>
          <span class="dot" style="background:${STATUS[l.status].color}" title="${STATUS[l.status].label}"></span>
        </button>`).join('')
      : '<div class="empty">Uyğun sahə yoxdur</div>';
    $$('.mini', panel).forEach((b) => {
      b.addEventListener('click', () => select(b.dataset.id));
      b.addEventListener('mouseenter', () => plots?.hover(b.dataset.id));
      b.addEventListener('mouseleave', () => plots?.hover(null));
    });
  }

  function select(id, { fly = true } = {}) {
    const l = list.find((x) => x.id === id);
    if (!l) return;
    current = l;
    spin.stop();
    plots.select(id);
    history.replaceState(null, '', `#/xerite/${id}`);
    $$('.mini', panel).forEach((b) => b.classList.toggle('active', b.dataset.id === id));
    const item = $(`.mini[data-id="${id}"]`, panel), pl = $('#plist');
    if (item) pl.scrollBy({ top: item.getBoundingClientRect().top - pl.getBoundingClientRect().top - 8, behavior: 'smooth' });
    const sameProject = l.project ? list.filter((x) => x.project === l.project) : [];
    drawer.innerHTML = `
      <button class="icon-btn drawer-close" aria-label="Bağla">✕</button>
      <div class="drawer-media">${coverHTML(l, { w: 760, h: 460, pad: 2 })}</div>
      <div class="drawer-body">
        <div class="drawer-top">${statusBadge(l.status)}<span class="muted">Kod: ${l.id}</span></div>
        <h2>${esc(l.title)}</h2>
        <div class="muted">${esc(l.region)} rayonu, ${esc(l.settlement)}</div>
        <div class="drawer-price"><strong>${fmtPrice(l.price)}</strong><span>${perSot(l)} / sot</span></div>
        <dl class="specs">
          <div><dt>Sahə</dt><dd>${fmtArea(l.area)}</dd></div>
          <div><dt>Təyinat</dt><dd>${esc(l.category)}</dd></div>
          <div><dt>Sənəd</dt><dd>${esc(l.document)}</dd></div>
          ${l.distances?.sea != null ? `<div><dt>Dənizə</dt><dd>${l.distances.sea} km</dd></div>` : ''}
          ${l.distances?.city != null ? `<div><dt>Mərkəzə</dt><dd>${l.distances.city} km</dd></div>` : ''}
        </dl>
        <div class="chips">${(l.features || []).map((f) => `<span class="chip-s">${esc(f)}</span>`).join('')}</div>
        ${sameProject.length ? `<div class="drawer-project"><span class="muted">${esc(l.project)} massivi:</span><div class="lots">${sameProject.map((x) => `<button class="lot-btn ${x.id === l.id ? 'cur' : ''}" style="--c:${STATUS[x.status].color}" data-id="${x.id}" title="${STATUS[x.status].label}">${x.lot}</button>`).join('')}</div></div>` : ''}
        <div class="drawer-actions">
          <a class="btn btn-accent" href="#/elan/${l.id}">Ətraflı bax</a>
          <a class="btn btn-ghost" href="${waLink(l)}" target="_blank" rel="noopener">WhatsApp</a>
        </div>
      </div>`;
    drawer.classList.add('open');
    drawer.setAttribute('aria-hidden', 'false');
    $('.drawer-close', drawer).addEventListener('click', closeDrawer);
    $$('.lot-btn', drawer).forEach((b) => b.addEventListener('click', () => select(b.dataset.id)));
    if (window.innerWidth <= 900) panel.classList.remove('open');
    if (fly) flyToListing(map, l, { padding: drawerPad(), pitch: 62, extraZoom: l.area > 80 ? -0.2 : 0 });
  }

  function closeDrawer() {
    current = null;
    plots.select(null);
    drawer.classList.remove('open');
    drawer.setAttribute('aria-hidden', 'true');
    $$('.mini', panel).forEach((b) => b.classList.remove('active'));
    history.replaceState(null, '', '#/xerite');
  }

  map.on('load', () => {
    plots = addPlots(map, filtered, { onSelect: (id) => select(id) });
    drawList();
    const initial = initialId && list.find((l) => l.id === initialId);
    if (initial) setTimeout(() => select(initial.id), 300);
    else if (filtered.length && filtered.length < list.length) fitListings(map, filtered, { padding: drawerPad() });
    else map.flyTo({ ...AZ_VIEW, zoom: AZ_VIEW.zoom + 0.2, duration: 2500 });
  });

  bindFilters(mf, () => {
    filtered = applyFilters(list);
    plots?.setData(filtered);
    drawList();
    if (current && !filtered.some((l) => l.id === current.id)) closeDrawer();
    clearTimeout(bindFilters._t);
    bindFilters._t = setTimeout(() => filtered.length && fitListings(map, filtered, { padding: drawerPad() }), 450);
  });

  $('#t3d').addEventListener('click', (e) => {
    const on = !map._is3d;
    set3D(map, on);
    e.currentTarget.classList.toggle('active', on);
    e.currentTarget.querySelector('span').textContent = on ? '3D' : '2D';
  });
  $('#tBase').addEventListener('click', (e) => {
    const next = map._base === 'satellite' ? 'street' : 'satellite';
    setBase(map, next);
    e.currentTarget.querySelector('span').textContent = next === 'satellite' ? 'Peyk' : 'Xəritə';
  });
  $('#tOrbit').addEventListener('click', (e) => {
    if (!map._is3d) $('#t3d').click();
    e.currentTarget.classList.toggle('active', spin.toggle());
  });
  $('#tHome').addEventListener('click', () => {
    closeDrawer();
    fitListings(map, filtered.length ? filtered : list, { padding: drawerPad() });
  });
  // Filtr modalı
  const openModal = () => {
    fmodal.classList.add('open');
    fmodal.setAttribute('aria-hidden', 'false');
    mf.focus({ preventScroll: true });
  };
  const closeModal = () => {
    fmodal.classList.remove('open');
    fmodal.setAttribute('aria-hidden', 'true');
    $('#fOpen').focus({ preventScroll: true });
  };
  $('#fOpen').addEventListener('click', openModal);
  $$('[data-close]', fmodal).forEach((b) => b.addEventListener('click', closeModal));
  $('#tList').addEventListener('click', () => panel.classList.toggle('open'));
  $('#panelClose').addEventListener('click', () => panel.classList.remove('open'));

  const onKey = (e) => {
    if (e.key !== 'Escape' || e.defaultPrevented) return;
    if (fmodal.classList.contains('open')) closeModal();
    else if (current) closeDrawer();
  };
  document.addEventListener('keydown', onKey);

  return () => {
    spin.stop();
    document.removeEventListener('keydown', onKey);
    map.remove();
  };
}
