// Admin 3D xəritə: bütün elanlar status rəngi ilə, sürətli status dəyişmə, müraciət sayı, redaktəyə keçid
import { getListings, saveListing, crmList } from '../../api.js';
import { STATUS } from '../../config.js';
import { $, esc, fmtPrice, fmtArea, perSot, satFigure, toast } from '../../util.js';
import { createMap, addPlots, setBase, set3D, flyToListing, fitListings } from '../../mapkit.js';
import { ic, statusSelect, leadPill, ago, handleAuthError } from './common.js';

export default async function mapPage(root) {
  let [list, leads] = await Promise.all([getListings(true), crmList('leads', true).catch(() => [])]);
  const show = new Set(Object.keys(STATUS));
  let selected = null;

  root.innerHTML = `
  <div class="amap-layout">
    <aside class="amap-panel">
      <div class="amap-head">
        <input type="search" placeholder="Elan, bölgə, kod…" id="mq" />
        <div class="amap-chips" id="chips"></div>
      </div>
      <div class="amap-list" id="mlist"></div>
    </aside>
    <div class="amap-wrap">
      <div id="amap3d" class="map"></div>
      <div class="amap-tools map-tools">
        <button class="tool active" id="t3d">${ic('globe', 16)}<span>3D</span></button>
        <button class="tool" id="tBase"><span>Xəritə</span></button>
        <button class="tool" id="tFit"><span>Hamısı</span></button>
        <a class="tool" href="#/admin/elanlar/yeni">${ic('plus', 16)}<span>Yeni elan</span></a>
      </div>
      <div class="map-legend">${Object.values(STATUS).map((s) => `<span><i style="background:${s.color}"></i>${s.label}</span>`).join('')}</div>
      <div class="amap-card" id="mcard"></div>
    </div>
  </div>`;

  const leadsOf = (id) => leads.filter((l) => l.listingId === id);
  const visible = () => {
    const q = $('#mq').value.toLowerCase().trim();
    return list.filter((l) => show.has(l.status) && (!q || `${l.title} ${l.region} ${l.settlement} ${l.id} ${l.project || ''}`.toLowerCase().includes(q)));
  };

  function drawChips() {
    $('#chips').innerHTML = Object.entries(STATUS).map(([k, v]) => `<button class="${show.has(k) ? 'on' : ''}" data-s="${k}"><i style="background:${v.color}"></i>${v.label}<b>${list.filter((l) => l.status === k).length}</b></button>`).join('');
  }

  function drawList() {
    const vis = visible();
    $('#mlist').innerHTML = vis.map((l) => {
      const n = leadsOf(l.id).length;
      return `<button class="mini ${l.id === selected ? 'active' : ''}" data-id="${l.id}">
        <span class="mini-img">${satFigure(l, { w: 184, h: 140, pad: 2 })}</span>
        <span class="mini-body"><span class="mini-loc">${esc(l.region)} · ${l.id}</span><strong>${esc(l.title)}</strong>
          <span class="mini-meta"><b class="price">${fmtPrice(l.price)}</b><span>${fmtArea(l.area)}</span>${n ? `<span class="mini-lc">${ic('inbox', 12)} ${n}</span>` : ''}</span></span>
        <i class="dot" style="background:${STATUS[l.status].color}"></i>
      </button>`;
    }).join('') || '<p class="muted small" style="padding:16px">Uyğun elan yoxdur.</p>';
    plots?.setData(vis);
  }

  function drawCard() {
    const l = list.find((x) => x.id === selected);
    const card = $('#mcard');
    if (!l) { card.classList.remove('open'); return; }
    const ls = leadsOf(l.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    card.innerHTML = `
      <button class="icon-btn amap-close" id="mclose" aria-label="Bağla">✕</button>
      <div class="amap-card-media">${satFigure(l, { w: 720, h: 400, pad: 2.2 })}</div>
      <div class="amap-card-body">
        <span class="muted small">Kod ${l.id} · ${esc(l.region)}, ${esc(l.settlement)}</span>
        <h3>${esc(l.title)}</h3>
        <div class="amap-nums"><div><span>Qiymət</span><b>${fmtPrice(l.price)}</b></div><div><span>Sahə</span><b>${fmtArea(l.area)}</b></div><div><span>1 sot</span><b>${perSot(l)}</b></div></div>
        <label class="amap-status">Status ${statusSelect(STATUS, l.status, 'id="mstatus"')}</label>
        <div class="amap-leads">
          <div class="panel-h"><strong>Müraciətlər (${ls.length})</strong>${ls.length ? `<a class="link-arrow small" href="#/admin/muracietler/elan-${l.id}">Hamısı →</a>` : ''}</div>
          ${ls.slice(0, 3).map((x) => `<a class="amap-lead" href="#/admin/muracietler/${x.id}"><span><strong>${esc(x.name)}</strong><small class="muted">${ago(x.createdAt)}</small></span>${leadPill(x.status)}</a>`).join('') || '<p class="muted small">Bu elana hələ müraciət gəlməyib.</p>'}
        </div>
        <div class="amap-actions">
          <a class="btn btn-sm btn-dark" href="#/admin/elanlar/${l.id}">${ic('edit', 15)} Redaktə et</a>
          <a class="btn btn-sm btn-ghost" href="#/elan/${l.id}" target="_blank">${ic('ext', 15)} Saytda bax</a>
        </div>
      </div>`;
    card.classList.add('open');
    $('#mclose').addEventListener('click', () => select(null));
    $('#mstatus').addEventListener('change', async (e) => {
      const prev = l.status;
      e.target.disabled = true;
      try {
        await saveListing({ id: l.id, status: e.target.value });
        l.status = e.target.value;
        toast(`Kod ${l.id}: «${STATUS[l.status].label}»`);
        drawChips(); drawList(); drawCard();
        plots.select(l.id);
      } catch (err) { e.target.value = prev; handleAuthError(err); e.target.disabled = false; }
    });
  }

  function select(id, fly = true) {
    selected = id;
    plots?.select(id);
    drawCard();
    document.querySelectorAll('#mlist .mini').forEach((b) => b.classList.toggle('active', b.dataset.id === id));
    const l = list.find((x) => x.id === id);
    if (l && fly) flyToListing(map, l, { padding: { top: 80, bottom: 80, left: 80, right: 440 }, duration: 1800 });
    if (id) document.querySelector(`#mlist .mini[data-id="${id}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  let plots = null;
  const map = createMap($('#amap3d'), { pitch: 50 });
  map.on('load', () => {
    plots = addPlots(map, visible(), { onSelect: (id) => select(id) });
    fitListings(map, visible(), { padding: 80, duration: 0 });
  });

  drawChips();
  drawList();
  $('#mq').addEventListener('input', drawList);
  $('#chips').addEventListener('click', (e) => {
    const b = e.target.closest('[data-s]');
    if (!b) return;
    show.has(b.dataset.s) ? show.delete(b.dataset.s) : show.add(b.dataset.s);
    if (!show.size) Object.keys(STATUS).forEach((k) => show.add(k));
    drawChips(); drawList();
  });
  $('#mlist').addEventListener('click', (e) => { const b = e.target.closest('.mini'); if (b) select(b.dataset.id); });
  $('#t3d').addEventListener('click', (e) => {
    set3D(map, !map._is3d);
    e.currentTarget.classList.toggle('active', map._is3d);
    e.currentTarget.querySelector('span').textContent = map._is3d ? '3D' : '2D';
  });
  $('#tBase').addEventListener('click', (e) => {
    setBase(map, map._base === 'satellite' ? 'street' : 'satellite');
    e.currentTarget.querySelector('span').textContent = map._base === 'satellite' ? 'Xəritə' : 'Peyk';
  });
  $('#tFit').addEventListener('click', () => { select(null, false); fitListings(map, visible(), { padding: 80 }); });

  return () => { try { map.stop(); map.remove(); } catch {} };
}
