// Müraciətlər: saytdan gələn sorğular + admin əl ilə əlavə etdikləri
import { getListings, crmList, crmSave, crmDelete } from '../../api.js';
import { $, esc, fmtPrice, toast } from '../../util.js';
import {
  LEAD_STATUS, LEAD_SOURCE, ic, ago, fmtDateTime, telHref, waHref, statusSelect, avatar, empty,
  leadForm, leadToClient, confirmClick, handleAuthError, updateCounts,
} from './common.js';

export default async function leadsPage(root, sub) {
  const [listings, clients] = await Promise.all([getListings(), crmList('clients', true)]);
  let leads = await crmList('leads', true);
  const byId = Object.fromEntries(listings.map((l) => [l.id, l]));
  const clientById = () => Object.fromEntries(clients.map((c) => [c.id, c]));
  let status = 'active';
  let listingFilter = sub?.startsWith('elan-') ? sub.slice(5) : '';

  root.innerHTML = `<section class="adm-page">
    <div class="admin-head">
      <div><h1>Müraciətlər <small class="muted" id="total"></small></h1>
        <p class="muted">Saytdakı elanlardan və əlaqə formasından gələn sorğular, həmçinin zəng və WhatsApp müraciətləri.</p></div>
      <div class="admin-actions">
        <input class="admin-search" type="search" placeholder="Ad, telefon, elan…" id="q" />
        <button class="btn btn-accent" id="add">${ic('plus', 16)} Müraciət</button>
      </div>
    </div>
    <div class="seg-tabs" id="tabs"></div>
    <div id="lf" class="filter-note"></div>
    <div class="table-wrap">
      <table class="table">
        <thead><tr><th>Müraciət edən</th><th>Elan</th><th>Mənbə</th><th>Tarix</th><th>Status</th><th></th></tr></thead>
        <tbody id="rows"></tbody>
      </table>
    </div>
  </section>`;

  const ctx = () => ({ listings, clients });
  const reload = async () => { leads = await crmList('leads', true); draw(); updateCounts(); };

  const TABS = [['active', 'Aktiv'], ['all', 'Hamısı'], ...Object.entries(LEAD_STATUS).map(([k, v]) => [k, v.label, v.color])];
  const match = (l, s) => s === 'all' || (s === 'active' ? !['won', 'lost'].includes(l.status) : l.status === s);

  function draw() {
    const q = $('#q').value.toLowerCase().trim();
    const base = leads.filter((l) => !listingFilter || l.listingId === listingFilter);
    $('#total').textContent = `(${leads.length})`;
    $('#tabs').innerHTML = TABS.map(([k, label, c]) => {
      const n = base.filter((l) => match(l, k)).length;
      return `<button class="${k === status ? 'on' : ''}" data-s="${k}">${c ? `<i style="background:${c}"></i>` : ''}${label}<b>${n}</b></button>`;
    }).join('');
    $('#lf').innerHTML = listingFilter
      ? `Elan: <strong>${esc(byId[listingFilter]?.title || listingFilter)}</strong> (kod ${esc(listingFilter)}) <button class="link-btn" id="clearLf">✕ filtri sil</button>`
      : '';
    $('#clearLf')?.addEventListener('click', () => { listingFilter = ''; history.replaceState(null, '', '#/admin/muracietler'); draw(); });

    const cById = clientById();
    const rows = base
      .filter((l) => match(l, status))
      .filter((l) => !q || `${l.name} ${l.phone} ${l.email} ${l.message} ${byId[l.listingId]?.title || ''} ${l.listingId}`.toLowerCase().includes(q))
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

    $('#rows').innerHTML = rows.length ? rows.map((l) => {
      const lst = byId[l.listingId];
      const cl = cById[l.clientId];
      return `<tr data-id="${l.id}" class="${l.status === 'new' ? 'is-new' : ''}">
        <td><div class="who">${avatar(l.name)}<div>
          <button class="link-strong" data-act="open">${esc(l.name)}</button>
          <div class="muted small"><a href="${telHref(l.phone)}">${esc(l.phone)}</a>${l.goal === 'satmaq' ? ' · <em>satmaq istəyir</em>' : ''}${l.budget ? ` · ${fmtPrice(l.budget)}` : ''}</div>
          ${l.message ? `<div class="msg">${esc(l.message)}</div>` : ''}
        </div></div></td>
        <td>${lst ? `<a href="#/admin/elanlar/${lst.id}" class="lst-link"><strong>${esc(lst.title)}</strong><span class="muted small">Kod ${lst.id} · ${esc(lst.region)}</span></a>` : l.listingId ? `<span class="muted small">Silinmiş elan (${esc(l.listingId)})</span>` : '<span class="muted">—</span>'}</td>
        <td><span class="src">${esc(LEAD_SOURCE[l.source] || l.source || '—')}</span></td>
        <td class="nowrap" title="${fmtDateTime(l.createdAt)}">${ago(l.createdAt)}</td>
        <td>${statusSelect(LEAD_STATUS, l.status, 'data-act="status"')}</td>
        <td class="t-actions">
          <a class="btn btn-xs btn-ghost icon-only" href="${telHref(l.phone)}" title="Zəng et">${ic('phone', 15)}</a>
          <a class="btn btn-xs btn-ghost icon-only" href="${waHref(l.phone, `Salam, ${l.name}! ${lst ? `“${lst.title}” elanı ilə bağlı yazıram.` : ''}`)}" target="_blank" rel="noopener" title="WhatsApp">${ic('wa', 15)}</a>
          ${cl ? `<a class="btn btn-xs btn-ghost" href="#/admin/musteriler/${cl.id}" title="Müştəri kartı">${ic('user', 14)} Kart</a>`
              : `<button class="btn btn-xs btn-dark" data-act="convert" title="Müştərilər siyahısına əlavə et">${ic('plus', 14)} Müştəri</button>`}
          <button class="btn btn-xs btn-danger icon-only" data-act="del" title="Sil">${ic('trash', 15)}</button>
        </td>
      </tr>`;
    }).join('') : `<tr><td colspan="6">${empty(leads.length ? 'Bu filtrə uyğun müraciət yoxdur.' : 'Hələ müraciət yoxdur. Saytdakı elanlardan sorğular burada görünəcək.')}</td></tr>`;
  }

  draw();
  $('#q').addEventListener('input', draw);
  $('#tabs').addEventListener('click', (e) => { const b = e.target.closest('[data-s]'); if (b) { status = b.dataset.s; draw(); } });
  $('#add').addEventListener('click', () => leadForm({ listingId: listingFilter }, ctx(), reload));

  $('#rows').addEventListener('change', async (e) => {
    const sel = e.target.closest('select[data-act=status]');
    if (!sel) return;
    const l = leads.find((x) => x.id === sel.closest('tr').dataset.id);
    sel.disabled = true;
    try {
      await crmSave('leads', { id: l.id, status: sel.value });
      toast(`${l.name}: «${LEAD_STATUS[sel.value].label}»`);
      await reload();
    } catch (err) { sel.value = l.status; handleAuthError(err); sel.disabled = false; }
  });

  $('#rows').addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-act]');
    if (!btn || btn.tagName === 'SELECT') return;
    const l = leads.find((x) => x.id === btn.closest('tr').dataset.id);
    if (btn.dataset.act === 'open') return leadForm(l, ctx(), reload);
    if (btn.dataset.act === 'convert') {
      btn.disabled = true;
      try {
        const c = await leadToClient(l, clients);
        if (!clients.some((x) => x.id === c.id)) clients.push(c);
        toast(`${c.name} müştərilərə əlavə olundu`);
        await reload();
      } catch (err) { handleAuthError(err); btn.disabled = false; }
    }
    if (btn.dataset.act === 'del') {
      if (!confirmClick(btn)) return;
      try { await crmDelete('leads', l.id); toast('Müraciət silindi'); await reload(); }
      catch (err) { handleAuthError(err); }
    }
  });

  // Dashboard-dan konkret müraciətə keçid
  if (sub && !sub.startsWith('elan-')) {
    const l = leads.find((x) => x.id === sub);
    if (l) leadForm(l, ctx(), reload);
  }
}
