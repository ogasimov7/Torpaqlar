// Müştərilər: siyahı (#/admin/musteriler) və müştəri kartı (#/admin/musteriler/:id)
import { getListings, crmList, crmSave, crmDelete } from '../../api.js';
import { $, esc, fmtPrice, fmtArea, toast, satFigure } from '../../util.js';
import {
  CLIENT_TYPE, CLIENT_STATUS, LEAD_SOURCE, TASK_TYPE, NOTE_COLORS, ic, ago, fmtDate, fmtDateTime, telHref, waHref,
  pill, leadPill, listingPill, statusSelect, avatar, empty, normPhone, budgetText, isOverdue, isToday,
  clientForm, leadForm, taskForm, noteForm, handleAuthError, updateCounts, confirmClick,
} from './common.js';

export default async function clientsPage(root, sub) {
  if (sub) return card(root, sub);
  return table(root);
}

async function load() {
  const [listings, clients, leads, tasks, notes] = await Promise.all([
    getListings(), crmList('clients', true), crmList('leads', true), crmList('tasks', true), crmList('notes', true),
  ]);
  return { listings, clients, leads, tasks, notes };
}

const leadsOf = (c, leads) => leads.filter((l) => l.clientId === c.id || (c.phone && normPhone(l.phone) === normPhone(c.phone)));

function lastActivity(c, d) {
  const dates = [c.updatedAt, c.createdAt,
    ...leadsOf(c, d.leads).map((l) => l.createdAt),
    ...d.notes.filter((n) => n.clientId === c.id).map((n) => n.createdAt),
    ...d.tasks.filter((t) => t.clientId === c.id).map((t) => t.updatedAt || t.createdAt)].filter(Boolean);
  return dates.sort().at(-1);
}

// ---------------- Siyahı ----------------
async function table(root) {
  let d = await load();
  let type = 'all';

  root.innerHTML = `<section class="adm-page">
    <div class="admin-head">
      <div><h1>Müştərilər <small class="muted" id="total"></small></h1>
        <p class="muted">Alıcı və satıcıların bazası: əlaqə məlumatları, büdcə, maraqlandığı sahələr və bütün tarixçə.</p></div>
      <div class="admin-actions">
        <input class="admin-search" type="search" placeholder="Ad, telefon, bölgə…" id="q" />
        <button class="btn btn-accent" id="add">${ic('plus', 16)} Müştəri</button>
      </div>
    </div>
    <div class="seg-tabs" id="tabs"></div>
    <div class="table-wrap">
      <table class="table">
        <thead><tr><th>Müştəri</th><th>Növ</th><th>Büdcə</th><th>Maraq</th><th>Müraciət</th><th>Son aktivlik</th><th>Status</th><th></th></tr></thead>
        <tbody id="rows"></tbody>
      </table>
    </div>
  </section>`;

  const reload = async () => { d = await load(); draw(); };

  function draw() {
    const q = $('#q').value.toLowerCase().trim();
    $('#total').textContent = `(${d.clients.length})`;
    const tabs = [['all', 'Hamısı'], ...Object.entries(CLIENT_TYPE)];
    $('#tabs').innerHTML = tabs.map(([k, label]) => `<button class="${k === type ? 'on' : ''}" data-t="${k}">${label}<b>${k === 'all' ? d.clients.length : d.clients.filter((c) => c.type === k).length}</b></button>`).join('');
    const rows = d.clients
      .filter((c) => type === 'all' || c.type === type)
      .filter((c) => !q || `${c.name} ${c.phone} ${c.phone2 || ''} ${c.email || ''} ${c.regions || ''} ${c.note || ''}`.toLowerCase().includes(q))
      .map((c) => ({ c, last: lastActivity(c, d) }))
      .sort((a, b) => (b.last || '').localeCompare(a.last || ''));
    $('#rows').innerHTML = rows.length ? rows.map(({ c, last }) => {
      const n = leadsOf(c, d.leads).length;
      return `<tr data-id="${c.id}">
        <td><a class="who" href="#/admin/musteriler/${c.id}">${avatar(c.name)}<div><strong>${esc(c.name)}</strong><div class="muted small">${esc(c.phone || '')}</div></div></a></td>
        <td>${esc(CLIENT_TYPE[c.type] || '—')}</td>
        <td class="nowrap">${budgetText(c) || '<span class="muted">—</span>'}</td>
        <td>${esc(c.regions || '')}${c.areaWanted ? `<div class="muted small">${esc(c.areaWanted)}</div>` : ''}${!c.regions && !c.areaWanted ? '<span class="muted">—</span>' : ''}</td>
        <td>${n || '<span class="muted">—</span>'}</td>
        <td class="nowrap">${last ? ago(last) : ''}</td>
        <td>${statusSelect(CLIENT_STATUS, c.status || 'active', 'data-act="status"')}</td>
        <td class="t-actions">
          <a class="btn btn-xs btn-ghost icon-only" href="${telHref(c.phone)}" title="Zəng et">${ic('phone', 15)}</a>
          <a class="btn btn-xs btn-ghost icon-only" href="${waHref(c.phone)}" target="_blank" rel="noopener" title="WhatsApp">${ic('wa', 15)}</a>
          <a class="btn btn-xs btn-dark" href="#/admin/musteriler/${c.id}">Kart ${ic('arrow', 14)}</a>
        </td>
      </tr>`;
    }).join('') : `<tr><td colspan="8">${empty(d.clients.length ? 'Axtarışa uyğun müştəri tapılmadı.' : 'Hələ müştəri yoxdur. Əl ilə əlavə edin və ya müraciəti müştəriyə çevirin.')}</td></tr>`;
  }

  draw();
  $('#q').addEventListener('input', draw);
  $('#tabs').addEventListener('click', (e) => { const b = e.target.closest('[data-t]'); if (b) { type = b.dataset.t; draw(); } });
  $('#add').addEventListener('click', () => clientForm(null, d, (c) => c && (location.hash = `#/admin/musteriler/${c.id}`)));
  $('#rows').addEventListener('change', async (e) => {
    const sel = e.target.closest('select[data-act=status]');
    if (!sel) return;
    const c = d.clients.find((x) => x.id === sel.closest('tr').dataset.id);
    try { await crmSave('clients', { id: c.id, status: sel.value }); toast(`${c.name}: «${CLIENT_STATUS[sel.value].label}»`); await reload(); }
    catch (err) { sel.value = c.status; handleAuthError(err); }
  });
}

// ---------------- Müştəri kartı ----------------
async function card(root, id) {
  let d = await load();
  let c = d.clients.find((x) => x.id === id);
  if (!c) {
    root.innerHTML = `<section class="adm-page">${empty('Müştəri tapılmadı (silinib ola bilər).', '<a class="btn btn-dark" href="#/admin/musteriler">Bütün müştərilər</a>')}</section>`;
    return;
  }
  const byId = () => Object.fromEntries(d.listings.map((l) => [l.id, l]));

  const reload = async () => {
    d = await load();
    c = d.clients.find((x) => x.id === id);
    if (!c) { location.hash = '#/admin/musteriler'; return; }
    draw();
    updateCounts();
  };

  function draw() {
    const L = byId();
    const leads = leadsOf(c, d.leads).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const tasks = d.tasks.filter((t) => t.clientId === c.id).sort((a, b) => a.done - b.done || (a.due || '9').localeCompare(b.due || '9'));
    const notes = d.notes.filter((n) => n.clientId === c.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const liked = (c.listingIds || []).map((x) => L[x]).filter(Boolean);
    const st = CLIENT_STATUS[c.status || 'active'];
    const row = (k, v) => (v ? `<div><dt>${k}</dt><dd>${v}</dd></div>` : '');

    root.innerHTML = `<section class="adm-page">
      <nav class="crumbs"><a href="#/admin/musteriler">Müştərilər</a><span>/</span><span>${esc(c.name)}</span></nav>
      <div class="client-head">
        ${avatar(c.name, 'av-lg')}
        <div class="grow">
          <h1>${esc(c.name)}</h1>
          <div class="client-tags">${pill(st.label, st.color)}<span class="chip-s">${esc(CLIENT_TYPE[c.type] || '')}</span>${c.source ? `<span class="chip-s">${esc(LEAD_SOURCE[c.source] || c.source)}</span>` : ''}<span class="muted small">Əlavə olunub: ${fmtDate(c.createdAt)}</span></div>
        </div>
        <div class="admin-actions">
          <a class="btn btn-sm btn-accent" href="${telHref(c.phone)}">${ic('phone', 15)} Zəng</a>
          <a class="btn btn-sm btn-wa" href="${waHref(c.phone, `Salam, ${c.name}!`)}" target="_blank" rel="noopener">${ic('wa', 15)} WhatsApp</a>
          <button class="btn btn-sm btn-ghost" id="edit">${ic('edit', 15)} Redaktə</button>
        </div>
      </div>

      <div class="client-grid">
        <div class="col">
          <div class="panel">
            <h3>Məlumat</h3>
            <dl class="kv">
              ${row('Telefon', `<a href="${telHref(c.phone)}">${esc(c.phone)}</a>`)}
              ${row('Əlavə telefon', c.phone2 ? `<a href="${telHref(c.phone2)}">${esc(c.phone2)}</a>` : '')}
              ${row('E-poçt', c.email ? `<a href="mailto:${esc(c.email)}">${esc(c.email)}</a>` : '')}
              ${row('Büdcə', budgetText(c))}
              ${row('Bölgələr', esc(c.regions || ''))}
              ${row('İstədiyi sahə', esc(c.areaWanted || ''))}
              ${row('Doğum günü', c.birthday ? fmtDate(c.birthday) : '')}
            </dl>
            ${c.note ? `<div class="note-box">${esc(c.note).replace(/\n/g, '<br/>')}</div>` : ''}
          </div>

          <div class="panel">
            <div class="panel-h"><h3>Maraqlandığı elanlar <small class="muted">${liked.length}</small></h3></div>
            <div class="liked">${liked.map((l) => `
              <div class="liked-it">
                <a href="#/admin/elanlar/${l.id}" class="liked-img">${satFigure(l, { w: 120, h: 80, pad: 2 })}</a>
                <div class="grow"><a href="#/admin/elanlar/${l.id}"><strong>${esc(l.title)}</strong></a>
                  <div class="muted small">${esc(l.region)} · ${fmtArea(l.area)} · ${fmtPrice(l.price)}</div>${listingPill(l.status)}</div>
                <button class="icon-btn" data-unlike="${l.id}" title="Siyahıdan çıxar">✕</button>
              </div>`).join('') || '<p class="muted small">Hələ elan əlavə olunmayıb.</p>'}</div>
            <div class="inline-add">
              <select id="likeSel"><option value="">+ Elan əlavə et…</option>${d.listings.filter((l) => !(c.listingIds || []).includes(l.id)).map((l) => `<option value="${l.id}">${esc(`${l.id} · ${l.title} (${l.region})`)}</option>`).join('')}</select>
            </div>
          </div>
        </div>

        <div class="col">
          <div class="panel">
            <div class="panel-h"><h3>Qeydlər <small class="muted">${notes.length}</small></h3></div>
            <form class="quick-note" id="qn">
              <textarea name="text" rows="3" placeholder="Zəngin nəticəsi, danışıq, razılaşma… (Ctrl+Enter — yadda saxla)" required></textarea>
              <div><button class="btn btn-sm btn-dark">Qeyd əlavə et</button></div>
            </form>
            <div class="timeline">${notes.map((n) => `
              <div class="tl-it" style="--nb:${NOTE_COLORS[n.color] || '#fff'}">
                <div class="tl-meta"><span>${fmtDateTime(n.createdAt)}</span>${n.listingId && L[n.listingId] ? `<a href="#/admin/elanlar/${n.listingId}">${esc(L[n.listingId].title)}</a>` : ''}<button class="link-btn" data-note="${n.id}">${ic('edit', 13)}</button></div>
                ${n.title ? `<strong>${esc(n.title)}</strong>` : ''}<p>${esc(n.text).replace(/\n/g, '<br/>')}</p>
              </div>`).join('') || '<p class="muted small">Qeyd yoxdur.</p>'}</div>
          </div>
        </div>

        <div class="col">
          <div class="panel">
            <div class="panel-h"><h3>Tapşırıqlar <small class="muted">${tasks.filter((t) => !t.done).length}</small></h3><button class="btn btn-xs btn-ghost" id="addTask">${ic('plus', 14)} Əlavə et</button></div>
            <div class="task-list">${tasks.map((t) => taskRow(t, L)).join('') || '<p class="muted small">Tapşırıq yoxdur.</p>'}</div>
          </div>
          <div class="panel">
            <div class="panel-h"><h3>Müraciətlər <small class="muted">${leads.length}</small></h3><button class="btn btn-xs btn-ghost" id="addLead">${ic('plus', 14)} Əlavə et</button></div>
            <div class="mini-leads">${leads.map((l) => `
              <button class="ml-it" data-lead="${l.id}">
                <div class="ml-top">${leadPill(l.status)}<span class="muted small">${ago(l.createdAt)}</span></div>
                <strong>${esc(L[l.listingId]?.title || (l.goal === 'satmaq' ? 'Torpaq satmaq istəyir' : 'Ümumi müraciət'))}</strong>
                ${l.message ? `<span class="muted small">${esc(l.message.slice(0, 120))}</span>` : ''}
              </button>`).join('') || '<p class="muted small">Müraciət yoxdur.</p>'}</div>
          </div>
          <button class="btn btn-sm btn-danger" id="delClient">${ic('trash', 15)} Müştərini sil</button>
        </div>
      </div>
    </section>`;
    bind();
  }

  function bind() {
    $('#edit').addEventListener('click', () => clientForm(c, d, reload));
    $('#delClient').addEventListener('click', async (e) => {
      if (!confirmClick(e.currentTarget)) return;
      try { await crmDelete('clients', c.id); toast('Müştəri silindi'); location.hash = '#/admin/musteriler'; }
      catch (err) { handleAuthError(err); }
    });
    $('#addTask').addEventListener('click', () => taskForm({ clientId: c.id }, d, reload));
    $('#addLead').addEventListener('click', () => leadForm({ clientId: c.id, name: c.name, phone: c.phone, email: c.email }, d, reload));
    root.querySelectorAll('[data-lead]').forEach((b) => b.addEventListener('click', () => leadForm(d.leads.find((l) => l.id === b.dataset.lead), d, reload)));
    root.querySelectorAll('[data-note]').forEach((b) => b.addEventListener('click', () => noteForm(d.notes.find((n) => n.id === b.dataset.note), d, reload)));
    bindTasks(root, d, reload);
    root.querySelectorAll('[data-unlike]').forEach((b) => b.addEventListener('click', async () => {
      try { await crmSave('clients', { id: c.id, listingIds: (c.listingIds || []).filter((x) => x !== b.dataset.unlike) }); await reload(); }
      catch (err) { handleAuthError(err); }
    }));
    $('#likeSel').addEventListener('change', async (e) => {
      if (!e.target.value) return;
      try { await crmSave('clients', { id: c.id, listingIds: [...(c.listingIds || []), e.target.value] }); toast('Elan əlavə olundu'); await reload(); }
      catch (err) { handleAuthError(err); }
    });
    const qn = $('#qn');
    const saveNote = async () => {
      const text = qn.elements.text.value.trim();
      if (!text) return qn.elements.text.focus();
      try { await crmSave('notes', { text, clientId: c.id, color: 'plain' }); toast('Qeyd əlavə olundu'); await reload(); }
      catch (err) { handleAuthError(err); }
    };
    qn.addEventListener('submit', (e) => { e.preventDefault(); saveNote(); });
    qn.elements.text.addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); saveNote(); } });
  }

  draw();
}

// Tapşırıq sətri — müştəri kartında, tapşırıqlar səhifəsində və icmalda eyni görünüş
export function taskRow(t, L = {}, C = {}) {
  const late = isOverdue(t);
  return `<div class="task ${t.done ? 'done' : ''} ${late ? 'late' : ''}" data-task="${t.id}">
    <label class="tick"><input type="checkbox" data-tick ${t.done ? 'checked' : ''} /><span></span></label>
    <button class="task-body" data-edit-task>
      <span class="task-title">${esc(t.title)}</span>
      <span class="task-meta">
        <span class="tt">${esc(TASK_TYPE[t.type] || '')}</span>
        ${t.due ? `<span class="${late ? 'late' : isToday(t.due) ? 'today' : ''}">${ic('clock', 12)} ${isToday(t.due) ? `Bu gün, ${fmtDateTime(t.due).split(', ')[1]}` : fmtDateTime(t.due)}</span>` : ''}
        ${t.clientId && C[t.clientId] ? `<span>${ic('user', 12)} ${esc(C[t.clientId].name)}</span>` : ''}
        ${t.listingId && L[t.listingId] ? `<span>${ic('plots', 12)} ${esc(L[t.listingId].title)}</span>` : ''}
      </span>
    </button>
  </div>`;
}

export function bindTasks(root, d, reload) {
  root.querySelectorAll('[data-task]').forEach((el) => {
    const t = d.tasks.find((x) => x.id === el.dataset.task);
    el.querySelector('[data-tick]').addEventListener('change', async (e) => {
      try {
        await crmSave('tasks', { id: t.id, done: e.target.checked, doneAt: e.target.checked ? new Date().toISOString() : '' });
        if (e.target.checked) toast('Tapşırıq tamamlandı ✓');
        await reload();
      } catch (err) { e.target.checked = !e.target.checked; handleAuthError(err); }
    });
    el.querySelector('[data-edit-task]').addEventListener('click', () => taskForm(t, d, reload));
  });
}
