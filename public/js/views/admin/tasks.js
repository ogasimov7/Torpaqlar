// Tapşırıqlar: zənglər, görüşlər, sahəyə baxışlar — tarixə görə qruplaşdırılır
import { getListings, crmList } from '../../api.js';
import { $ } from '../../util.js';
import { TASK_TYPE, ic, empty, isOverdue, isToday, dayKey, taskForm, updateCounts } from './common.js';
import { taskRow, bindTasks } from './clients.js';

export default async function tasksPage(root) {
  const load = async () => {
    const [listings, clients, tasks] = await Promise.all([getListings(), crmList('clients', true), crmList('tasks', true)]);
    return { listings, clients, tasks };
  };
  let d = await load();
  let view = 'open';
  let type = '';

  root.innerHTML = `<section class="adm-page">
    <div class="admin-head">
      <div><h1>Tapşırıqlar</h1><p class="muted">Zənglər, görüşlər, sahəyə baxışlar və sənəd işləri — heç nə yaddan çıxmasın.</p></div>
      <div class="admin-actions">
        <select id="type"><option value="">Bütün növlər</option>${Object.entries(TASK_TYPE).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select>
        <button class="btn btn-accent" id="add">${ic('plus', 16)} Tapşırıq</button>
      </div>
    </div>
    <div class="seg-tabs" id="tabs"></div>
    <div id="groups"></div>
  </section>`;

  const reload = async () => { d = await load(); draw(); updateCounts(); };

  function draw() {
    const L = Object.fromEntries(d.listings.map((l) => [l.id, l]));
    const C = Object.fromEntries(d.clients.map((c) => [c.id, c]));
    const all = d.tasks.filter((t) => !type || t.type === type);
    const open = all.filter((t) => !t.done);
    const tabs = [['open', 'Aktiv', open.length], ['done', 'Tamamlanmış', all.length - open.length], ['all', 'Hamısı', all.length]];
    $('#tabs').innerHTML = tabs.map(([k, label, n]) => `<button class="${k === view ? 'on' : ''}" data-v="${k}">${label}<b>${n}</b></button>`).join('');

    const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
    const weekEnd = new Date(); weekEnd.setDate(weekEnd.getDate() + 7);
    const groups = [
      ['Gecikmiş', (t) => isOverdue(t), 'late'],
      ['Bu gün', (t) => !t.done && isToday(t.due)],
      ['Sabah', (t) => !t.done && t.due && dayKey(t.due) === dayKey(tomorrow)],
      ['Bu həftə', (t) => !t.done && t.due && new Date(t.due) > tomorrow && dayKey(t.due) !== dayKey(tomorrow) && new Date(t.due) <= weekEnd],
      ['Sonra', (t) => !t.done && t.due && new Date(t.due) > weekEnd],
      ['Tarixsiz', (t) => !t.done && !t.due],
      ['Tamamlanmış', (t) => t.done, 'muted'],
    ];
    const pool = view === 'open' ? open : view === 'done' ? all.filter((t) => t.done) : all;
    const sortDue = (a, b) => (a.due || '9').localeCompare(b.due || '9');
    const html = groups.map(([title, fn, cls]) => {
      const items = pool.filter(fn).sort(title === 'Tamamlanmış' ? (a, b) => (b.doneAt || '').localeCompare(a.doneAt || '') : sortDue);
      return items.length ? `<div class="task-group ${cls || ''}"><h3>${title} <small>${items.length}</small></h3><div class="panel task-list">${items.map((t) => taskRow(t, L, C)).join('')}</div></div>` : '';
    }).join('');
    $('#groups').innerHTML = html || empty(view === 'done' ? 'Tamamlanmış tapşırıq yoxdur.' : 'Aktiv tapşırıq yoxdur. Gözəl! 🎉', `<button class="btn btn-dark btn-sm" id="add2">${ic('plus', 15)} Tapşırıq əlavə et</button>`);
    $('#add2')?.addEventListener('click', () => taskForm(null, d, reload));
    bindTasks($('#groups'), d, reload);
  }

  draw();
  $('#tabs').addEventListener('click', (e) => { const b = e.target.closest('[data-v]'); if (b) { view = b.dataset.v; draw(); } });
  $('#type').addEventListener('change', (e) => { type = e.target.value; draw(); });
  $('#add').addEventListener('click', () => taskForm(null, d, reload));
}
