// Elanlar: #/admin/elanlar (siyahı), #/admin/elanlar/yeni (yeni elan), #/admin/elanlar/:id (redaktə)
import { getListings, saveListing, deleteListing, uploadImage, adminKey, crmList } from '../../api.js';
import { STATUS, CATEGORIES, DOCUMENTS, FEATURES } from '../../config.js';
import { $, $$, esc, fmtPrice, fmtArea, areaSot, centroid, bounds, toast, satFigure } from '../../util.js';
import { createMap, addPlots, setBase } from '../../mapkit.js';
import { rerender } from './common.js';

export default async function listingsPage(root, sub) {
  if (sub === 'yeni') return editor(root, null);
  if (sub) {
    const list = await getListings(true);
    const item = list.find((l) => l.id === sub);
    if (!item) { location.hash = '#/admin/elanlar'; return; }
    return editor(root, item);
  }
  return table(root);
}

// ---------------- Siyahı ----------------
async function table(root) {
  const [list, leads] = await Promise.all([getListings(true), crmList('leads', true).catch(() => [])]);
  const count = (s) => list.filter((l) => l.status === s).length;
  const leadCount = (id) => leads.filter((x) => x.listingId === id).length;
  root.innerHTML = `<section class="adm-page">
    <div class="admin-head">
      <div><h1>Elanlar <small class="muted">(${list.length})</small></h1>
        <p class="muted" id="counts">${Object.entries(STATUS).map(([k, v]) => `${v.label}: <strong>${count(k)}</strong>`).join(' · ')}</p></div>
      <div class="admin-actions">
        <input class="admin-search" type="search" placeholder="Axtar…" id="aq" />
        <a class="btn btn-accent" href="#/admin/elanlar/yeni">+ Yeni elan</a>
      </div>
    </div>
    <div class="table-wrap">
      <table class="table">
        <thead><tr><th></th><th>Elan</th><th>Bölgə</th><th>Sahə</th><th>Qiymət</th><th>Sorğu</th><th>Status</th><th></th></tr></thead>
        <tbody id="rows"></tbody>
      </table>
    </div>
  </section>`;

  const draw = () => {
    const q = $('#aq').value.toLowerCase();
    $('#rows').innerHTML = list
      .filter((l) => !q || `${l.title} ${l.region} ${l.settlement} ${l.id}`.toLowerCase().includes(q))
      .map((l) => `<tr data-id="${l.id}">
        <td class="t-thumb">${satFigure(l, { w: 120, h: 80, pad: 2 })}</td>
        <td><a href="#/admin/elanlar/${l.id}"><strong>${esc(l.title)}</strong></a><div class="muted small">Kod ${l.id} · ${esc(l.category)}</div></td>
        <td>${esc(l.region)}<div class="muted small">${esc(l.settlement)}</div></td>
        <td>${fmtArea(l.area)}</td>
        <td>${fmtPrice(l.price)}</td>
        <td>${leadCount(l.id) ? `<a class="count-link" href="#/admin/muracietler/elan-${l.id}" title="Bu elana gələn müraciətlər">${leadCount(l.id)}</a>` : '<span class="muted">—</span>'}</td>
        <td><select class="status-select" data-act="status" style="--c:${STATUS[l.status].color}" title="Statusu dəyiş">
          ${Object.entries(STATUS).map(([k, v]) => `<option value="${k}" data-color="${v.color}" ${k === l.status ? 'selected' : ''}>${v.label}</option>`).join('')}
        </select></td>
        <td class="t-actions">
          <a class="btn btn-sm btn-ghost" href="#/elan/${l.id}" target="_blank">Bax</a>
          <a class="btn btn-sm btn-dark" href="#/admin/elanlar/${l.id}">Redaktə</a>
          <button class="btn btn-sm btn-danger" data-act="del">Sil</button>
        </td></tr>`)
      .join('');
  };
  draw();
  $('#aq').addEventListener('input', draw);
  // Statusu cədvəldən birbaşa dəyişmək
  $('#rows').addEventListener('change', async (e) => {
    const sel = e.target.closest('select[data-act=status]');
    if (!sel) return;
    const l = list.find((x) => String(x.id) === sel.closest('tr').dataset.id);
    const prev = l.status;
    sel.disabled = true;
    try {
      await saveListing({ id: l.id, status: sel.value });
      l.status = sel.value;
      sel.style.setProperty('--c', STATUS[l.status].color);
      $('#counts').innerHTML = Object.entries(STATUS).map(([k, v]) => `${v.label}: <strong>${count(k)}</strong>`).join(' · ');
      toast(`Kod ${l.id}: status «${STATUS[l.status].label}» oldu`);
    } catch (err) {
      sel.value = prev;
      toast(err.message, 'err');
    }
    sel.disabled = false;
  });
  $('#rows').addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-act=del]');
    if (!btn) return;
    if (!btn.classList.contains('confirm')) {
      btn.classList.add('confirm');
      btn.textContent = 'Əminsiniz?';
      setTimeout(() => { btn.classList.remove('confirm'); btn.textContent = 'Sil'; }, 3000);
      return;
    }
    const id = btn.closest('tr').dataset.id;
    try { await deleteListing(id); toast('Elan silindi'); rerender(); }
    catch (err) { toast(err.message, 'err'); }
  });
}

// ---------------- Koordinatların oxunması ----------------
// Dəstəklənən formatlar (hər sətirdə bir nöqtə və ya ";" ilə ayrılmış):
//   40.5687, 50.0605  |  40.5687 50.0605  |  40,5687 50,0605
//   40°34'07.3"N 50°03'37.8"E  |  Google Maps linki (…/@40.5687,50.0605,17z)
function parsePoint(raw) {
  let line = raw.trim();
  if (!line) return null;
  let a, b;
  const link = line.match(/@(-?\d+\.\d+),\s*(-?\d+\.\d+)/) || line.match(/[?&](?:q|query|ll)=(-?\d+\.\d+),\s*(-?\d+\.\d+)/);
  const dms = [...line.matchAll(/(\d+(?:\.\d+)?)\s*°\s*(?:(\d+(?:\.\d+)?)\s*['′’]\s*)?(?:(\d+(?:\.\d+)?)\s*(?:"|″|”|'')\s*)?([NSEWnsew])?/g)];
  if (link) {
    [a, b] = [+link[1], +link[2]];
  } else if (dms.length >= 2) {
    const val = (m) => {
      const v = +m[1] + (+m[2] || 0) / 60 + (+m[3] || 0) / 3600;
      return [/[SWsw]/.test(m[4] || '') ? -v : v, (m[4] || '').toUpperCase()];
    };
    const [[v1, h1], [v2]] = dms.map(val);
    [a, b] = h1 === 'E' || h1 === 'W' ? [v2, v1] : [v1, v2];
  } else {
    if (!line.includes('.')) line = line.replace(/(\d),(\d)/g, '$1.$2'); // 40,5687 → 40.5687
    const nums = line.match(/-?\d+(?:\.\d+)?/g);
    if (!nums || nums.length < 2) return null;
    [a, b] = [+nums[0], +nums[1]];
  }
  // Azərbaycan üçün: en 38–42, uzunluq 44–51 — tərs yazılıbsa yerini dəyiş
  if (Math.abs(a) > 90 || (a > 43 && a < 52 && b > 37 && b < 43)) [a, b] = [b, a];
  if (!Number.isFinite(a) || !Number.isFinite(b) || Math.abs(a) > 90 || Math.abs(b) > 180) return null;
  return [+b.toFixed(7), +a.toFixed(7)]; // [uzunluq, en]
}

function parseCoords(text) {
  const lines = text.split(/\n|;/).map((s) => s.trim()).filter(Boolean);
  const pts = [], bad = [];
  lines.forEach((l, i) => { const p = parsePoint(l); p ? pts.push(p) : bad.push(i + 1); });
  if (pts.length > 3 && pts[0][0] === pts.at(-1)[0] && pts[0][1] === pts.at(-1)[1]) pts.pop();
  return { pts, bad };
}

const fmtPt = ([lng, lat]) => `${lat.toFixed(6)}, ${lng.toFixed(6)}`;

function square([lng, lat], sot, rot = 0) {
  const s = Math.sqrt(sot * 100) / 2;
  const kx = 111320 * Math.cos((lat * Math.PI) / 180), ky = 110540, r = (rot * Math.PI) / 180;
  return [[-s, -s], [s, -s], [s, s], [-s, s]].map(([x, y]) => [
    +(lng + (x * Math.cos(r) - y * Math.sin(r)) / kx).toFixed(7),
    +(lat + (x * Math.sin(r) + y * Math.cos(r)) / ky).toFixed(7),
  ]);
}

// ---------------- Elan forması ----------------
async function editor(root, item) {
  const list = await getListings(true);
  const l = item ? structuredClone(item) : {
    title: '', region: '', settlement: '', category: CATEGORIES[0], area: '', price: '', status: 'available',
    document: DOCUMENTS[0], features: [], distances: {}, featured: false, description: '', polygon: [], photos: [],
  };
  let ring = l.polygon.length ? l.polygon.slice(0, -1) : [];
  let point = null; // tək nöqtə (sahənin mərkəzi)
  const regions = [...new Set(list.map((x) => x.region))];
  const projects = [...new Set(list.map((x) => x.project).filter(Boolean))];

  root.innerHTML = `  <section class="adm-page">
    <div class="admin-head">
      <div><h1>${item ? 'Elanı redaktə et' : 'Yeni elan əlavə et'}</h1>
        ${item ? `<p class="muted">Kod ${l.id} · <a class="link-arrow" href="#/elan/${l.id}" target="_blank">saytda bax ↗</a></p>` : ''}
        <ol class="steps"><li id="st1">Sahənin yeri</li><li id="st2">Detallar</li><li id="st3">Fotolar</li></ol>
      </div>
      <div class="admin-actions"><a class="btn btn-ghost" href="#/admin/elanlar">Ləğv et</a><button class="btn btn-accent" id="save">Yadda saxla</button></div>
    </div>

    <div class="editor">
      <div class="editor-map">
        <div class="ed-card">
          <h2 class="ed-title"><span>1</span>Sahənin yeri</h2>
          <div class="draw-bar">
            <input id="goto" placeholder="Yer tap: koordinat və ya Google Maps linki" />
            <button type="button" class="btn btn-sm btn-dark" id="gotoBtn">Get</button>
          </div>
          <div class="draw-map"><div id="amap" class="map"></div><div class="draw-hint" id="hint"></div></div>
          <div class="draw-bar">
            <button type="button" class="btn btn-sm btn-accent" id="drawBtn">Xəritədə çək</button>
            <button type="button" class="btn btn-sm btn-ghost" id="undoBtn">Son nöqtəni sil</button>
            <button type="button" class="btn btn-sm btn-ghost" id="clearBtn">Təmizlə</button>
            <button type="button" class="btn btn-sm btn-ghost" id="baseBtn">Xəritə</button>
            <span class="draw-area" id="calc"></span>
          </div>

          <div class="coords">
            <div class="coords-head">
              <strong>Koordinatlarla daxil et</strong>
              <span class="muted small">Hər sətirdə bir künc: <code>en, uzunluq</code></span>
            </div>
            <textarea id="coords" rows="5" spellcheck="false" placeholder="40.568700, 50.060500&#10;40.568900, 50.061100&#10;40.568300, 50.061300&#10;40.568100, 50.060700"></textarea>
            <div class="coords-msg" id="cmsg"></div>
            <div class="draw-bar">
              <button type="button" class="btn btn-sm btn-dark" id="applyBtn">Xəritəyə tətbiq et</button>
              <button type="button" class="btn btn-sm btn-ghost" id="squareBtn" title="Tək nöqtə (mərkəz) və “Sahə (sot)” əsasında kvadrat sahə qurur">Mərkəzdən kvadrat qur</button>
              <button type="button" class="btn btn-sm btn-ghost" id="copyBtn">Kopyala</button>
            </div>
            <p class="muted small">Qəbul olunur: <code>40.5687, 50.0605</code> · <code>40°34'07"N 50°03'38"E</code> · Google Maps linki. Yalnız 1 nöqtə yazsanız, mərkəz kimi qəbul olunur — sahə ölçüsünü yazıb “Mərkəzdən kvadrat qur” basın.</p>
          </div>
        </div>
      </div>

      <form class="editor-form" id="ef" novalidate>
        <h2 class="ed-title full"><span>2</span>Detallar</h2>
        <label class="full">Başlıq *<input name="title" required value="${esc(l.title)}" placeholder="Məs: Dağ mənzərəli torpaq, Vəndam" /></label>
        <label>Rayon / bölgə *<input name="region" required list="regions" value="${esc(l.region)}" placeholder="Abşeron" /></label>
        <datalist id="regions">${regions.map((r) => `<option value="${esc(r)}">`).join('')}</datalist>
        <label>Kənd / qəsəbə *<input name="settlement" required value="${esc(l.settlement)}" placeholder="Bilgəh" /></label>
        <label>Təyinat<select name="category">${CATEGORIES.map((c) => `<option ${c === l.category ? 'selected' : ''}>${c}</option>`).join('')}</select></label>
        <label>Sənəd<select name="document">${DOCUMENTS.map((c) => `<option ${c === l.document ? 'selected' : ''}>${c}</option>`).join('')}</select></label>
        <label>Sahə (sot) *<input name="area" type="number" step="0.1" min="0" required value="${l.area}" /></label>
        <label>Qiymət (₼) *<input name="price" type="number" step="100" min="0" required value="${l.price}" /><small class="muted" id="perSot"></small></label>
        <label>Status<select name="status">${Object.entries(STATUS).map(([k, v]) => `<option value="${k}" data-color="${v.color}" ${k === l.status ? 'selected' : ''}>${v.label}</option>`).join('')}</select></label>
        <label class="check"><input type="checkbox" name="featured" ${l.featured ? 'checked' : ''} /> Ana səhifədə seçilmiş</label>
        <label>Dənizə məsafə (km)<input name="sea" type="number" step="0.1" min="0" value="${l.distances?.sea ?? ''}" /></label>
        <label>Mərkəzə məsafə (km)<input name="city" type="number" step="0.1" min="0" value="${l.distances?.city ?? ''}" /></label>
        <label>Layihə / massiv<input name="project" list="projects" value="${esc(l.project || '')}" placeholder="ixtiyari" /></label>
        <datalist id="projects">${projects.map((r) => `<option value="${esc(r)}">`).join('')}</datalist>
        <label>Parsel №<input name="lot" type="number" value="${l.lot ?? ''}" placeholder="ixtiyari" /></label>
        <fieldset class="full"><legend>Kommunikasiya və üstünlüklər</legend>
          <div class="checks">${FEATURES.map((f) => `<label class="chip"><input type="checkbox" name="features" value="${f}" ${l.features?.includes(f) ? 'checked' : ''} /><span>${f}</span></label>`).join('')}</div>
        </fieldset>
        <label class="full">Təsvir<textarea name="description" rows="7" placeholder="Sahənin yeri, relyefi, yola və kommunikasiyalara çıxışı, nəyə yararlı olduğu…">${esc(l.description)}</textarea></label>

        <h2 class="ed-title full"><span>3</span>Fotolar</h2>
        <div class="full">
          <div class="photos" id="photos"></div>
          <div class="photo-add">
            <label class="btn btn-sm btn-dark file-btn">Şəkil yüklə<input type="file" accept="image/png,image/jpeg,image/webp" multiple id="file" hidden /></label>
            <input id="purl" placeholder="və ya şəkil linki (https://…)" /><button type="button" class="btn btn-sm btn-ghost" id="paddBtn">Əlavə et</button>
          </div>
          <p class="muted small">İlk şəkil əsas şəkil olur. Foto olmasa, sahənin peyk görüntüsü avtomatik göstərilir.</p>
        </div>
        <div class="full form-foot"><button type="button" class="btn btn-accent btn-block" id="save2">Yadda saxla</button></div>
      </form>
    </div>
  </section>`;

  const form = $('#ef');
  const txt = $('#coords');
  // Sahə xanası əl ilə dəyişdirilməyibsə, sərhəd dəyişdikcə avtomatik yenilənir
  let areaAuto = !form.area.value;
  form.area.addEventListener('input', () => (areaAuto = false));
  const autoArea = () => {
    if (ring.length >= 3 && (areaAuto || !form.area.value)) { form.area.value = areaSot(ring).toFixed(1); areaAuto = true; updPerSot(); }
  };

  // --- Qiymət / sot ---
  const updPerSot = () => {
    const a = +form.area.value, p = +form.price.value;
    $('#perSot').textContent = a > 0 && p > 0 ? `1 sot: ${fmtPrice(p / a)}` : '';
    $('#st2').classList.toggle('done', !!(form.elements.title.value && form.region.value && form.settlement.value && a && p));
  };
  form.addEventListener('input', updPerSot);
  updPerSot();

  // --- Fotolar ---
  const photos = l.photos || [];
  const drawPhotos = () => {
    $('#photos').innerHTML = photos.map((p, i) => `<div class="photo"><img src="${esc(p)}" alt="" /><button type="button" data-i="${i}" aria-label="Sil">✕</button>${i === 0 ? '<span>Əsas</span>' : ''}</div>`).join('');
    $('#st3').classList.toggle('done', photos.length > 0);
  };
  drawPhotos();
  $('#photos').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-i]');
    if (b) { photos.splice(+b.dataset.i, 1); drawPhotos(); }
  });
  $('#file').addEventListener('change', async (e) => {
    for (const f of e.target.files) {
      try { photos.push((await uploadImage(f)).url); drawPhotos(); }
      catch (err) { toast(err.message, 'err'); }
    }
    e.target.value = '';
  });
  $('#paddBtn').addEventListener('click', () => {
    const u = $('#purl').value.trim();
    if (/^https?:\/\//.test(u)) { photos.push(u); $('#purl').value = ''; drawPhotos(); }
  });

  // --- Xəritə ---
  const start = ring.length ? centroid(ring) : [49.9, 40.45];
  const map = createMap($('#amap'), { center: start, zoom: ring.length ? 16.5 : 8.5, pitch: 0, bearing: 0 });
  map._is3d = false;
  let drawing = false, dragIdx = -1;
  const pin = new maplibregl.Marker({ color: '#e7b84a' });

  const geo = () => ({
    type: 'FeatureCollection',
    features: [
      ...(ring.length >= 3 ? [{ type: 'Feature', geometry: { type: 'Polygon', coordinates: [[...ring, ring[0]]] }, properties: {} }] : []),
      ...(ring.length >= 2 ? [{ type: 'Feature', geometry: { type: 'LineString', coordinates: drawing ? ring : [...ring, ring[0]] }, properties: {} }] : []),
      ...ring.map((c, i) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: c }, properties: { i, n: String(i + 1) } })),
    ],
  });

  const fit = () => {
    if (ring.length >= 2) {
      const b = bounds(ring);
      map.fitBounds([[b[0], b[1]], [b[2], b[3]]], { padding: 90, maxZoom: 18, duration: 1200 });
    } else if (point) map.flyTo({ center: point, zoom: 17, duration: 1400 });
  };

  function refresh({ syncText = true } = {}) {
    map.getSource('draw')?.setData(geo());
    const a = areaSot(ring);
    $('#calc').innerHTML = ring.length >= 3
      ? `Hesablanmış: <strong>${a.toFixed(1)} sot</strong> <button type="button" class="link" id="useArea">sahəyə yaz</button>`
      : `${ring.length} nöqtə`;
    $('#useArea')?.addEventListener('click', () => { form.area.value = a.toFixed(1); areaAuto = true; updPerSot(); });
    autoArea();
    $('#hint').textContent = drawing
      ? 'Sahənin künclərinə ardıcıl klikləyin. Bitirmək üçün 1-ci nöqtəyə klikləyin və ya Enter basın.'
      : ring.length >= 3 ? 'Hazırdır. Nöqtələri sürüşdürərək düzəldə bilərsiniz.'
      : point ? 'Mərkəz nöqtə qoyuldu. Sahə ölçüsünü yazıb “Mərkəzdən kvadrat qur” basın və ya künclərini çəkin.'
      : 'Sahəni tapın, sonra “Xəritədə çək” basın və ya aşağıda koordinatları yazın.';
    $('#drawBtn').classList.toggle('active', drawing);
    $('#drawBtn').textContent = drawing ? 'Bitir' : ring.length ? 'Yenidən çək' : 'Xəritədə çək';
    $('#st1').classList.toggle('done', ring.length >= 3);
    if (syncText && document.activeElement !== txt) txt.value = ring.length ? ring.map(fmtPt).join('\n') : point ? fmtPt(point) : '';
    if (ring.length >= 3) pin.remove();
  }

  map.on('load', () => {
    map.setTerrain(null);
    addPlots(map, list.filter((x) => x.id !== l.id), { markers: false });
    map.addSource('draw', { type: 'geojson', data: geo() });
    map.addLayer({ id: 'draw-fill', type: 'fill', source: 'draw', filter: ['==', '$type', 'Polygon'], paint: { 'fill-color': '#e7b84a', 'fill-opacity': 0.3 } });
    map.addLayer({ id: 'draw-line', type: 'line', source: 'draw', filter: ['==', '$type', 'LineString'], paint: { 'line-color': '#e7b84a', 'line-width': 2.5, 'line-dasharray': [2, 1] } });
    map.addLayer({ id: 'draw-pts', type: 'circle', source: 'draw', filter: ['==', '$type', 'Point'], paint: { 'circle-radius': 8, 'circle-color': '#fff', 'circle-stroke-color': '#e7b84a', 'circle-stroke-width': 3 } });
    refresh();

    map.on('click', (e) => {
      if (!drawing) return;
      const hit = map.queryRenderedFeatures(e.point, { layers: ['draw-pts'] })[0];
      if (hit && hit.properties.i === 0 && ring.length >= 3) { drawing = false; map.getCanvas().style.cursor = ''; return finishDraw(); }
      ring.push([+e.lngLat.lng.toFixed(7), +e.lngLat.lat.toFixed(7)]);
      refresh();
    });
    map.on('mouseenter', 'draw-pts', () => (map.getCanvas().style.cursor = drawing ? 'pointer' : 'move'));
    map.on('mouseleave', 'draw-pts', () => (map.getCanvas().style.cursor = drawing ? 'crosshair' : ''));
    map.on('mousedown', 'draw-pts', (e) => {
      if (drawing) return;
      e.preventDefault();
      dragIdx = e.features[0].properties.i;
      map.dragPan.disable();
    });
    map.on('mousemove', (e) => {
      if (dragIdx < 0) return;
      ring[dragIdx] = [+e.lngLat.lng.toFixed(7), +e.lngLat.lat.toFixed(7)];
      refresh();
    });
    map.on('mouseup', () => { if (dragIdx >= 0) { dragIdx = -1; map.dragPan.enable(); } });
  });

  function finishDraw() {
    refresh();
  }

  $('#drawBtn').addEventListener('click', () => {
    if (drawing) { drawing = false; finishDraw(); }
    else { drawing = true; ring = []; pin.remove(); refresh(); }
    map.getCanvas().style.cursor = drawing ? 'crosshair' : '';
  });
  $('#undoBtn').addEventListener('click', () => { ring.pop(); refresh(); });
  $('#clearBtn').addEventListener('click', () => { ring = []; point = null; pin.remove(); drawing = false; refresh(); $('#cmsg').textContent = ''; });
  $('#baseBtn').addEventListener('click', (e) => {
    setBase(map, map._base === 'satellite' ? 'street' : 'satellite');
    e.currentTarget.textContent = map._base === 'satellite' ? 'Xəritə' : 'Peyk';
  });

  // Yer axtarışı (yalnız xəritəni hərəkət etdirir)
  const goto = () => {
    const p = parsePoint($('#goto').value);
    if (!p) return toast('Koordinat oxunmadı', 'err');
    map.flyTo({ center: p, zoom: 17, duration: 1600 });
  };
  $('#gotoBtn').addEventListener('click', goto);
  $('#goto').addEventListener('keydown', (e) => e.key === 'Enter' && (e.preventDefault(), goto()));

  // Koordinat mətnindən sahə
  const applyText = ({ quiet = false } = {}) => {
    const { pts, bad } = parseCoords(txt.value);
    const msg = $('#cmsg');
    msg.className = 'coords-msg';
    if (bad.length) { msg.classList.add('err'); msg.textContent = `${bad.join(', ')}-ci sətir oxunmadı.`; }
    else msg.textContent = '';
    if (pts.length >= 3) {
      ring = pts; point = null; drawing = false;
      refresh({ syncText: false });
      if (!bad.length) { msg.classList.add('ok'); msg.textContent = `${pts.length} künc · ${areaSot(ring).toFixed(1)} sot`; }
      if (!quiet) fit();
    } else if (pts.length === 1) {
      ring = []; point = pts[0];
      pin.setLngLat(point).addTo(map);
      refresh({ syncText: false });
      if (!bad.length) { msg.classList.add('ok'); msg.textContent = 'Mərkəz nöqtə qoyuldu.'; }
      if (!quiet) fit();
    } else if (pts.length === 2 && !bad.length) {
      msg.textContent = 'Sahə üçün ən azı 3 künc lazımdır (və ya mərkəz üçün 1 nöqtə).';
    }
  };
  let tmr;
  txt.addEventListener('input', () => { clearTimeout(tmr); tmr = setTimeout(() => applyText({ quiet: true }), 500); });
  txt.addEventListener('blur', () => refresh());
  $('#applyBtn').addEventListener('click', () => applyText());
  $('#squareBtn').addEventListener('click', () => {
    const sot = +form.area.value;
    if (!sot) { form.area.focus(); return toast('Əvvəlcə “Sahə (sot)” yazın', 'err'); }
    const c = point || (ring.length ? centroid(ring) : [map.getCenter().lng, map.getCenter().lat]);
    ring = square(c, sot); point = null; drawing = false;
    refresh(); fit();
    toast(`${sot} sotluq kvadrat quruldu — künclərini sürüşdürüb dəqiqləşdirin`);
  });
  $('#copyBtn').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(txt.value); toast('Koordinatlar kopyalandı'); } catch { txt.select(); }
  });

  const onKey = (e) => {
    if (e.key === 'Enter' && drawing && ring.length >= 3 && !['INPUT', 'TEXTAREA'].includes(e.target.tagName)) {
      drawing = false; map.getCanvas().style.cursor = ''; finishDraw();
    }
  };
  document.addEventListener('keydown', onKey);

  // --- Yadda saxla ---
  async function save() {
    if (ring.length < 3) {
      $('.editor-map').scrollIntoView({ behavior: 'smooth' });
      return toast('Sahənin sərhədini çəkin və ya koordinatlarını yazın (ən azı 3 künc)', 'err');
    }
    if (!form.checkValidity()) {
      const bad = form.querySelector(':invalid');
      bad?.focus();
      return toast(`Doldurun: ${bad?.closest('label')?.firstChild.textContent.replace('*', '').trim() || 'məcburi xanalar'}`, 'err');
    }
    const d = new FormData(form);
    const data = {
      ...l,
      title: d.get('title').trim(),
      region: d.get('region').trim(),
      settlement: d.get('settlement').trim(),
      category: d.get('category'),
      document: d.get('document'),
      area: +d.get('area'),
      price: +d.get('price'),
      status: d.get('status'),
      featured: d.get('featured') === 'on',
      features: d.getAll('features'),
      distances: { ...(d.get('sea') ? { sea: +d.get('sea') } : {}), ...(d.get('city') ? { city: +d.get('city') } : {}) },
      project: d.get('project').trim() || undefined,
      lot: d.get('lot') ? +d.get('lot') : undefined,
      description: d.get('description').trim(),
      polygon: [...ring, ring[0]],
      photos,
    };
    $$('#save, #save2').forEach((b) => (b.disabled = true));
    try {
      const saved = await saveListing(data);
      if (item) { toast('Dəyişikliklər yadda saxlanıldı'); location.hash = '#/admin/elanlar'; }
      else success(root, saved);
    } catch (err) {
      toast(err.message, 'err');
      if (/İcazə/.test(err.message)) { adminKey.clear(); rerender(); }
    } finally {
      $$('#save, #save2').forEach((b) => (b.disabled = false));
    }
  }
  $('#save').addEventListener('click', save);
  $('#save2').addEventListener('click', save);

  return () => { document.removeEventListener('keydown', onKey); try { map.remove(); } catch {} };
}

function success(root, l) {
  window.scrollTo(0, 0);
  root.innerHTML = `  <section class="adm-page">
    <div class="success">
      <div class="success-media">${satFigure(l, { w: 640, h: 420, pad: 2.2 })}</div>
      <div class="success-body">
        <span class="success-ic">✓</span>
        <h1>Elan əlavə olundu</h1>
        <p class="muted">“${esc(l.title)}” · Kod ${l.id} · ${fmtArea(l.area)} · ${fmtPrice(l.price)}</p>
        <div class="success-actions">
          <a class="btn btn-accent" href="#/elan/${l.id}" target="_blank">Elanı saytda aç ↗</a>
          <a class="btn btn-dark" href="#/admin/xerite">Paneldə 3D xəritə</a>
          <a class="btn btn-ghost" href="#/admin/elanlar/yeni" id="again">+ Daha bir elan</a>
          <a class="btn btn-ghost" href="#/admin/elanlar">Bütün elanlar</a>
        </div>
      </div>
    </div>
  </section>`;
  // eyni hash olduğu üçün “daha bir elan” üçün marşrutu məcburi yenilə
  $('#again').addEventListener('click', (e) => { e.preventDefault(); rerender(); });
}
