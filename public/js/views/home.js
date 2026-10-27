import { getListings } from '../api.js';
import { SITE, STATUS } from '../config.js';
import { $, $$, esc, cardHTML, filters, fmtNum, satImage, satFigure, fmtPrice, fmtArea, waLink, icon } from '../util.js';
import { createMap, addPlots, orbit } from '../mapkit.js';

export default async function home(root) {
  const list = await getListings();
  const active = list.filter((l) => l.status !== 'sold');
  const regions = [...new Set(list.map((l) => l.region))];
  const totalHa = active.reduce((s, l) => s + l.area, 0) / 100;
  const minPerSot = Math.min(...active.map((l) => l.price / l.area));
  const featured = list.filter((l) => l.featured && l.status !== 'sold').slice(0, 6);
  const project = list.filter((l) => l.project === 'Bilgəh Bağları');
  const pill = featured.find((l) => l.settlement === 'Qusar') || featured[0] || list[0];
  const bento = featured[1] || list[0];

  const byRegion = regions
    .map((r) => ({ r, items: active.filter((l) => l.region === r) }))
    .filter((x) => x.items.length)
    .sort((a, b) => b.items.length - a.items.length);

  root.innerHTML = `
  <section class="hero">
    <div class="hero-map" id="heroMap"></div>
    <div class="hero-mist" aria-hidden="true"><i class="mist-blur"></i><i class="mist-a"></i><i class="mist-b"></i></div>
    <div class="hero-sun" aria-hidden="true"><i class="sun-warm"></i><i class="sun-rays"></i><i class="sun-glow"></i></div>
    <div class="container hero-inner">
      <a class="hero-chip" href="#/xerite"><i>${icon('arrow', 10)}</i>${active.length} sahə satışda · 3D xəritəyə bax</a>
      <h1>Torpağı almadan əvvəl<br/><span class="h-pill"><img src="${satImage(pill.polygon, { w: 220, h: 120, pad: 3 }).url}" alt="" /></span> <em>3D xəritədə</em> gəzin</h1>
      <p class="hero-lead">Abşeron sahillərindən Qəbələ dağlarına qədər yoxlanılmış sənədli torpaq sahələri — dəqiq sərhəd, qiymət və sənəd bir yerdə.</p>
      <form class="hero-search" id="heroSearch">
        <label><span>Bölgə</span><select name="region"><option value="">Bütün bölgələr</option>${byRegion.map((x) => `<option>${esc(x.r)}</option>`).join('')}</select></label>
        <label><span>Təyinat</span><select name="category"><option value="">Hamısı</option>${[...new Set(list.map((l) => l.category))].map((c) => `<option>${esc(c)}</option>`).join('')}</select></label>
        <label><span>Büdcə</span><input name="maxPrice" type="number" min="0" step="1000" inputmode="numeric" placeholder="Maks. qiymət, ₼" /></label>
        <button class="search-btn" type="submit" aria-label="Axtar"><svg viewBox="0 0 24 24" width="18" height="18"><circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="m20 20-4-4" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg></button>
      </form>
    </div>
    <div class="hero-stage"></div>
  </section>

  <section class="container stats">
    <div><strong>${active.length}</strong><span>aktiv <br/>elan</span></div>
    <div><strong>${regions.length}</strong><span>rayon və <br/>bölgə</span></div>
    <div><strong>${fmtNum(totalHa)} ha</strong><span>satışda olan <br/>torpaq</span></div>
    <div><strong>${fmtNum(minPerSot)} ₼</strong><span>1 sotun ən <br/>aşağı qiyməti</span></div>
  </section>

  <section class="section container">
    <div class="section-head">
      <div><span class="eyebrow">Seçilmiş</span><h2>Bu həftənin diqqətçəkən sahələri</h2></div>
      <a class="btn btn-outline btn-sm" href="#/elanlar">Bütün elanlar ${icon('arrow')}</a>
    </div>
    <div class="grid cards">${featured.map(cardHTML).join('')}</div>
  </section>

  <section class="section container why">
    <div class="why-copy">
      <div>
        <span class="eyebrow">Niyə Torpaqlar</span>
        <h2>Torpağın dəyərini almadan əvvəl görün</h2>
      </div>
      <div>
        <p class="muted">Sahələri yerində yoxlayırıq, sənədlərini əvvəlcədən araşdırırıq və hər birini peyk görüntüsü ilə dəqiq sərhədləri üzərində göstəririk. Siz yalnız seçirsiniz.</p>
        <a class="btn btn-dark" href="#/elanlar">Sahəni tap ${icon('arrow')}</a>
      </div>
    </div>
    <div class="bento">
      <a class="bento-card" href="#/elanlar">
        <div class="fake-search">${icon('pin', 13)}<span>Qusar, 20 sot, 50 000 ₼-a qədər</span></div>
        <h3>Ağıllı filtrlər</h3>
        <p>Bölgə, təyinat, qiymət və 1 sotun qiyməti üzrə uyğun sahəni saniyələr içində tapın.</p>
      </a>
      <div class="bento-card">
        <span class="bento-ic"><svg viewBox="0 0 24 24" width="20" height="20"><path d="M12 3 4.5 6v5.5c0 4.6 3.2 8 7.5 9.5 4.3-1.5 7.5-4.9 7.5-9.5V6L12 3Z" fill="currentColor"/><path d="m8.8 12 2.2 2.2 4.4-4.4" fill="none" stroke="#1d362b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
        <h3>Yoxlanılmış sənəd</h3>
        <p>Kupça və bələdiyyə sənədləri satışdan əvvəl yoxlanılır.</p>
      </div>
      <a class="bento-card bento-wide" href="#/xerite/${bento.id}">
        <div class="bento-text">
          <h3>3D xəritədə sərhədlər</h3>
          <p>Sahənin konturunu relyef və peyk görüntüsü üzərində görün, ətrafını 360° fırladın.</p>
        </div>
        <div class="bento-art">
          <span class="dots"></span>
          <svg class="route" viewBox="0 0 220 90" preserveAspectRatio="none"><path d="M20 70 C 70 10, 140 10, 200 40" fill="none" stroke="currentColor" stroke-width="1.6" stroke-dasharray="4 5"/></svg>
          <span class="price-pin">${fmtPrice(bento.price)}</span>
          <div class="mini-card">
            ${satFigure(bento, { w: 260, h: 150, pad: 2.2 })}
            <strong>${esc(bento.title)}</strong>
            <small>${esc(bento.settlement)}, ${esc(bento.region)}</small>
          </div>
        </div>
      </a>
    </div>
  </section>

  ${project.length ? projectSection(project) : ''}

  <section class="section container">
    <div class="section-head">
      <div><span class="eyebrow">Bölgələr</span><h2>Harada torpaq axtarırsınız?</h2></div>
    </div>
    <div class="regions">
      ${byRegion.map(({ r, items }) => {
        const min = Math.min(...items.map((l) => l.price));
        const s = satImage(items[0].polygon, { w: 480, h: 320, pad: 30, minSize: 3000 });
        return `<button class="region" data-region="${esc(r)}">
          <img src="${s.url}" alt="" loading="lazy" />
          <span class="region-txt"><strong>${esc(r)}</strong><small>${items.length} sahə · ${fmtPrice(min)}-dan</small></span>
        </button>`;
      }).join('')}
    </div>
  </section>

  <section class="section container">
    <div class="cta">
      <div>
        <h2>Torpağınızı satmaq istəyirsiniz?</h2>
        <p>Sahənizi peyk görüntüsü və 3D xəritə ilə təqdim edək — alıcılar sərhədləri dərhal görsün.</p>
      </div>
      <div class="cta-actions">
        <a class="btn btn-accent" href="${waLink()}" target="_blank" rel="noopener">WhatsApp ilə yazın</a>
        <a class="btn btn-ghost-light" href="tel:${SITE.phone.replace(/\s/g, '')}">${esc(SITE.phone)}</a>
      </div>
    </div>
  </section>`;

  // Axtarış formu → kataloq
  $('#heroSearch').addEventListener('submit', (e) => {
    e.preventDefault();
    const d = new FormData(e.target);
    Object.assign(filters, { region: d.get('region'), category: d.get('category'), maxPrice: d.get('maxPrice'), q: '' });
    location.hash = '#/elanlar';
  });
  $$('.region', root).forEach((b) => b.addEventListener('click', () => {
    Object.assign(filters, { region: b.dataset.region, category: '', q: '' });
    location.hash = '#/xerite';
  }));

  return heroMap(list);
}

// Hero: canlı 3D peyk xəritəsi — Qusar dağları üzərində yavaş fırlanır, üfüqdə duman
function heroMap(list) {
  const map = createMap($('#heroMap'), { interactive: false, center: [48.415, 41.405], zoom: 13.4, pitch: 72, bearing: -30 });
  let spin;
  map.on('load', () => {
    // Üfüq saytın fon rənginə qarışan dumanla bitir
    map.setSky({
      'sky-color': '#f9f3e6',
      'horizon-color': '#faf0d8',
      'fog-color': '#f7f1e4',
      'sky-horizon-blend': 1,
      'horizon-fog-blend': 1,
      'fog-ground-blend': 0.25,
      'atmosphere-blend': 0,
    });
    // Günəşli, canlı rənglər
    map.setPaintProperty('sat', 'raster-saturation', 0.15);
    map.setPaintProperty('sat', 'raster-contrast', 0.12);
    map.setPaintProperty('sat', 'raster-brightness-min', 0.04);
    addPlots(map, list, { markers: false, tooltip: false });
    const showcase = list.find((l) => l.settlement === 'Qusar') || list[0];
    map.jumpTo({ center: showcase.polygon[0] });
    spin = orbit(map, { speed: 2.2, stopOnInteract: false });
    spin.start();
  });
  return () => { spin?.stop(); map.remove(); };
}

function projectSection(lots) {
  const all = lots.flatMap((l) => l.polygon);
  const s = satImage(all, { w: 1200, h: 620, pad: 1.18 });
  // Hər parsel eyni çərçivədə çəkilir
  const R = 6378137;
  const merc = ([lon, lat]) => [(R * lon * Math.PI) / 180, R * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360))];
  const bb = new URL(s.url).searchParams.get('bbox').split(',').map(Number);
  const toPx = ([x, y]) => `${(((x - bb[0]) / (bb[2] - bb[0])) * s.w).toFixed(1)},${(((bb[3] - y) / (bb[3] - bb[1])) * s.h).toFixed(1)}`;
  const counts = Object.fromEntries(Object.keys(STATUS).map((k) => [k, lots.filter((l) => l.status === k).length]));
  const avail = lots.filter((l) => l.status === 'available');
  const minPrice = Math.min(...(avail.length ? avail : lots).map((l) => l.price));
  return `<section class="section project">
    <div class="container project-grid">
      <div class="project-copy">
        <span class="eyebrow">Layihə · Bilgəh</span>
        <h2>Bilgəh Bağları</h2>
        <p>Dənizə 1.3 km məsafədə, qapalı massivdə ${lots.length} parsel. Daxili yollar, işıq, su və qaz xətləri hazırdır. Parseli seçin — rəng statusu göstərir.</p>
        <ul class="project-stats">
          ${Object.entries(STATUS).map(([k, v]) => `<li><i style="background:${v.color}"></i>${v.label}<strong>${counts[k]}</strong></li>`).join('')}
        </ul>
        <div class="project-price">Parsellər <strong>${fmtPrice(minPrice)}</strong>-dan · ${fmtArea(lots[0].area)}</div>
        <a class="btn btn-accent" href="#/xerite/${(avail[0] || lots[0]).id}">Massivi 3D xəritədə aç ${icon('arrow')}</a>
      </div>
      <div class="project-plan">
        <img src="${s.url}" alt="Bilgəh Bağları peyk görüntüsü" loading="lazy" />
        <svg viewBox="0 0 ${s.w} ${s.h}" preserveAspectRatio="xMidYMid slice">
          ${lots.map((l) => {
            const pts = l.polygon.map(merc);
            const c = pts.slice(0, -1).reduce((a, p) => [a[0] + p[0] / 4, a[1] + p[1] / 4], [0, 0]);
            return `<a href="#/elan/${l.id}"><g class="lot lot-${l.status}">
              <polygon points="${pts.map(toPx).join(' ')}" style="--c:${STATUS[l.status].color}"><title>Sahə №${l.lot} — ${STATUS[l.status].label} — ${fmtPrice(l.price)}</title></polygon>
              <text x="${toPx(c).split(',')[0]}" y="${toPx(c).split(',')[1]}">${l.lot}</text></g></a>`;
          }).join('')}
        </svg>
      </div>
    </div>
  </section>`;
}
