// İcmal: əsas göstəricilər, son müraciətlər, yaxın tapşırıqlar, elanların vəziyyəti
import { getListings, crmList } from '../../api.js';
import { STATUS } from '../../config.js';
import { $, esc, fmtPrice, fmtShort, satFigure } from '../../util.js';
import {
  LEAD_STATUS, ic, ago, avatar, leadPill, empty, isOverdue, isToday, telHref, waHref,
  leadForm, clientForm, taskForm, noteForm, updateCounts, fmtLongDate,
} from './common.js';
import { taskRow, bindTasks } from './clients.js';
import { SUB_STATUS, matches } from './submissions.js';

export default async function dashboard(root) {
  const load = async () => {
    const [listings, leads, clients, tasks, notes, subs] = await Promise.all([
      getListings(true), crmList('leads', true), crmList('clients', true), crmList('tasks', true), crmList('notes', true), crmList('submissions', true),
    ]);
    return { listings, leads, clients, tasks, notes, subs };
  };
  let d = await load();
  const reload = async () => { d = await load(); draw(); updateCounts(); };

  function draw() {
    const L = Object.fromEntries(d.listings.map((l) => [l.id, l]));
    const C = Object.fromEntries(d.clients.map((c) => [c.id, c]));
    const avail = d.listings.filter((l) => l.status === 'available');
    const newLeads = d.leads.filter((l) => l.status === 'new');
    const week = d.leads.filter((l) => Date.now() - new Date(l.createdAt) < 7 * 864e5);
    const openTasks = d.tasks.filter((t) => !t.done);
    const late = openTasks.filter(isOverdue);
    const today = openTasks.filter((t) => isToday(t.due));
    const upcoming = openTasks.filter((t) => t.due).sort((a, b) => a.due.localeCompare(b.due)).slice(0, 6);
    const recent = [...d.leads].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 6);
    const won = d.leads.filter((l) => l.status === 'won').length;
    const closed = won + d.leads.filter((l) => l.status === 'lost').length;

    const byListing = {};
    d.leads.forEach((l) => { if (L[l.listingId]) byListing[l.listingId] = (byListing[l.listingId] || 0) + 1; });
    const top = Object.entries(byListing).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const maxTop = top[0]?.[1] || 1;

    const funnel = Object.entries(LEAD_STATUS).map(([k, v]) => [v, d.leads.filter((l) => l.status === k).length]);
    const total = d.listings.length || 1;
    const pendingSell = d.subs.filter((x) => x.type === 'sell' && ['new', 'reviewing'].includes(x.status));
    const activeSeek = d.subs.filter((x) => x.type === 'seek' && ['new', 'contacted', 'offered'].includes(x.status));
    const latestSubs = [...pendingSell, ...activeSeek].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5);
    const h = new Date().getHours();
    const hello = h < 12 ? 'Sabahınız xeyir' : h < 18 ? 'Günortanız xeyir' : 'Axşamınız xeyir';

    root.innerHTML = `<section class="adm-page">
      <div class="admin-head">
        <div><h1>${hello}!</h1><p class="muted">${fmtLongDate()} · bu gün ${today.length} tapşırıq${late.length ? `, <strong class="t-late">${late.length} gecikmiş</strong>` : ''}</p></div>
        <div class="admin-actions quick">
          <a class="btn btn-sm btn-accent" href="#/admin/elanlar/yeni">${ic('plus', 15)} Elan</a>
          <button class="btn btn-sm btn-ghost" data-q="lead">${ic('plus', 15)} Müraciət</button>
          <button class="btn btn-sm btn-ghost" data-q="client">${ic('plus', 15)} Müştəri</button>
          <button class="btn btn-sm btn-ghost" data-q="task">${ic('plus', 15)} Tapşırıq</button>
          <button class="btn btn-sm btn-ghost" data-q="note">${ic('plus', 15)} Qeyd</button>
        </div>
      </div>

      <div class="kpis">
        <a class="kpi" href="#/admin/elanlar"><span class="kpi-ic">${ic('plots')}</span><span class="kpi-l">Satışda olan elanlar</span><strong>${avail.length}<small> / ${d.listings.length}</small></strong><span class="kpi-s">Ümumi dəyər: ${fmtShort(avail.reduce((s, l) => s + (+l.price || 0), 0))}</span></a>
        <a class="kpi ${newLeads.length ? 'hot' : ''}" href="#/admin/muracietler"><span class="kpi-ic">${ic('inbox')}</span><span class="kpi-l">Yeni müraciətlər</span><strong>${newLeads.length}</strong><span class="kpi-s">Son 7 gündə: ${week.length}</span></a>
        <a class="kpi" href="#/admin/musteriler"><span class="kpi-ic">${ic('users')}</span><span class="kpi-l">Müştərilər</span><strong>${d.clients.length}</strong><span class="kpi-s">Uğurlu sövdələşmə: ${won}${closed ? ` (${Math.round((won / closed) * 100)}%)` : ''}</span></a>
        <a class="kpi ${late.length ? 'warn' : ''}" href="#/admin/tapsiriqlar"><span class="kpi-ic">${ic('tasks')}</span><span class="kpi-l">Aktiv tapşırıqlar</span><strong>${openTasks.length}</strong><span class="kpi-s">${late.length ? `${late.length} gecikmiş · ` : ''}Bu gün: ${today.length}</span></a>
      </div>

      <div class="dash-grid">
        <div class="panel span2">
          <div class="panel-h"><h3>Son müraciətlər</h3><a class="link-arrow small" href="#/admin/muracietler">Hamısı →</a></div>
          <div class="lead-feed">${recent.map((l) => `
            <div class="lf-it ${l.status === 'new' ? 'is-new' : ''}">
              ${avatar(l.name)}
              <a class="grow" href="#/admin/muracietler/${l.id}">
                <strong>${esc(l.name)}</strong> <span class="muted small">· ${ago(l.createdAt)}</span>
                <div class="muted small">${L[l.listingId] ? esc(L[l.listingId].title) : l.goal === 'satmaq' ? 'Torpaq satmaq istəyir' : 'Ümumi müraciət'}${l.message ? ` — ${esc(l.message.slice(0, 80))}` : ''}</div>
              </a>
              ${leadPill(l.status)}
              <a class="btn btn-xs btn-ghost icon-only" href="${telHref(l.phone)}" title="${esc(l.phone)}">${ic('phone', 15)}</a>
              <a class="btn btn-xs btn-ghost icon-only" href="${waHref(l.phone)}" target="_blank" rel="noopener" title="WhatsApp">${ic('wa', 15)}</a>
            </div>`).join('') || empty('Hələ müraciət yoxdur. Saytdakı elanlardan gələn sorğular burada görünəcək.')}</div>
        </div>

        <div class="panel">
          <div class="panel-h"><h3>Yaxın tapşırıqlar</h3><a class="link-arrow small" href="#/admin/tapsiriqlar">Hamısı →</a></div>
          <div class="task-list" id="dTasks">${upcoming.map((t) => taskRow(t, L, C)).join('') || '<p class="muted small">Planlaşdırılmış tapşırıq yoxdur.</p>'}</div>
        </div>

        <div class="panel span2">
          <div class="panel-h"><h3>Saytdan elanlar</h3><a class="link-arrow small" href="#/admin/sorgular">Hamısı →</a></div>
          <div class="sub-stats">
            <a href="#/admin/sorgular" class="${pendingSell.length ? 'hot' : ''}" data-st="sell"><strong>${pendingSell.length}</strong><span>satış elanı təsdiq gözləyir</span></a>
            <a href="#/admin/sorgular" data-st="seek"><strong>${activeSeek.length}</strong><span>aktiv axtarış sorğusu</span></a>
          </div>
          <div class="lead-feed">${latestSubs.map((x) => {
            const st = SUB_STATUS[x.type][x.status];
            const m = x.type === 'seek' ? matches(x, d.listings).length : 0;
            return `<div class="lf-it ${x.status === 'new' ? 'is-new' : ''}">
              ${avatar(x.name)}
              <a class="grow" href="#/admin/sorgular/${x.id}">
                <strong>${esc(x.name)}</strong> <span class="muted small">· ${x.type === 'sell' ? 'satır' : 'axtarır'} · ${ago(x.createdAt)}</span>
                <div class="muted small">${x.type === 'sell' ? `${esc(x.region)} · ${x.area} sot · ${fmtPrice(+x.price)}` : `${esc(x.region || '')}${x.budgetMax ? ` · ${fmtPrice(+x.budgetMax)}-a qədər` : ''} · ${m} uyğun elan`}</div>
              </a>
              <span class="pill" style="--c:${st.color}"><i></i>${st.label}</span>
            </div>`;
          }).join('') || '<p class="muted small">Gözləyən sorğu yoxdur.</p>'}</div>
        </div>

        <div class="panel">
          <div class="panel-h"><h3>Müraciət mərhələləri</h3></div>
          <div class="funnel">${funnel.map(([v, n]) => `
            <div class="fn-row"><span><i style="background:${v.color}"></i>${v.label}</span><b>${n}</b>
              <div class="bar"><span style="width:${d.leads.length ? (n / d.leads.length) * 100 : 0}%;background:${v.color}"></span></div></div>`).join('')}</div>
        </div>

        <div class="panel">
          <div class="panel-h"><h3>Elanların vəziyyəti</h3><a class="link-arrow small" href="#/admin/xerite">Xəritədə →</a></div>
          <div class="stack-bar">${Object.entries(STATUS).map(([k, v]) => { const n = d.listings.filter((l) => l.status === k).length; return n ? `<span style="flex:${n};background:${v.color}" title="${v.label}: ${n}"></span>` : ''; }).join('')}</div>
          <div class="stack-legend">${Object.entries(STATUS).map(([k, v]) => { const n = d.listings.filter((l) => l.status === k).length; return `<div><i style="background:${v.color}"></i>${v.label}<b>${n}</b><span class="muted small">${Math.round((n / total) * 100)}%</span></div>`; }).join('')}</div>
        </div>

        <div class="panel span2">
          <div class="panel-h"><h3>Ən çox sorğu alan elanlar</h3></div>
          <div class="top-list">${top.map(([id, n]) => `
            <a href="#/admin/muracietler/elan-${id}" class="top-it">
              <span class="top-img">${satFigure(L[id], { w: 96, h: 64, pad: 2 })}</span>
              <span class="grow"><strong>${esc(L[id].title)}</strong><span class="muted small">${fmtPrice(L[id].price)}</span>
                <span class="bar"><span style="width:${(n / maxTop) * 100}%"></span></span></span>
              <b>${n}</b>
            </a>`).join('') || '<p class="muted small">Hələ sorğu yoxdur.</p>'}</div>
        </div>
      </div>
    </section>`;

    bindTasks($('#dTasks'), d, reload);
    root.querySelectorAll('[data-st]').forEach((a) => a.addEventListener('click', () => sessionStorage.setItem('subType', a.dataset.st)));
    root.querySelectorAll('[data-q]').forEach((b) => b.addEventListener('click', () => {
      const f = { lead: leadForm, client: clientForm, task: taskForm, note: noteForm }[b.dataset.q];
      f(null, d, reload);
    }));
  }
  draw();
}
