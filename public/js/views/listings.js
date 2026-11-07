import { getListings } from '../api.js';
import { $, cardHTML, filtersHTML, bindFilters, applyFilters } from '../util.js';

export default async function listings(root) {
  const list = await getListings();
  root.innerHTML = `
  <section class="page-head container">
    <span class="eyebrow">Kataloq</span>
    <h1>Satılan torpaq sahələri</h1>
  </section>
  <section class="container catalog">
    <div class="catalog-bar">${filtersHTML(list)}</div>
    <div class="catalog-meta"><span id="count"></span></div>
    <div class="grid cards" id="grid"></div>
  </section>`;

  const draw = () => {
    const res = applyFilters(list);
    $('#count').textContent = `${res.length} sahə tapıldı`;
    $('#grid').innerHTML = res.length ? res.map(cardHTML).join('') : `<div class="empty">Filtrlərə uyğun sahə tapılmadı. <button class="btn btn-sm btn-ghost" onclick="document.querySelector('.filters').reset()">Filtrləri sıfırla</button></div>`;
  };
  bindFilters($('.filters', root), draw);
  draw();
}
