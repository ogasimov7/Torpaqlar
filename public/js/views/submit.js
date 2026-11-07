// Saytdan elan yerləşdirmək: "Torpaq satıram" və ya "Torpaq axtarıram".
// Göndərilən elan dərhal saytda görünmür — admin paneldə yoxlanılır, təsdiqlənir və ya müştəri ilə əlaqə saxlanılır.
import { getListings, submitListing, uploadSubmissionImage } from '../api.js';
import { SITE, CATEGORIES, DOCUMENTS, FEATURES } from '../config.js';
import { $, esc, toast, waLink } from '../util.js';

const MAX_PHOTOS = 8;

export default async function submit(root, mode) {
  const list = await getListings().catch(() => []);
  const regions = [...new Set(list.map((l) => l.region))].sort((a, b) => a.localeCompare(b, 'az'));
  let type = mode === 'axtariram' ? 'seek' : 'sell';
  const photos = [];

  root.innerHTML = `
  <section class="page-head container">
    <span class="eyebrow">Elan yerləşdir</span>
    <h1>Torpaq satırsınız və ya axtarırsınız?</h1>
    <p class="muted page-lead">Formu doldurun — makler məlumatları yoxlayıb sizinlə əlaqə saxlayacaq. Satış elanları yoxlanıldıqdan sonra saytda dərc olunur.</p>
  </section>
  <section class="container submit-wrap">
    <form class="submit-form" id="sf" novalidate>
      <div class="seg seg-lg" role="radiogroup" aria-label="Elanın növü">
        <label><input type="radio" name="type" value="sell" ${type === 'sell' ? 'checked' : ''} /><span><b>Torpaq satıram</b><small>Sahəmi satışa çıxarmaq istəyirəm</small></span></label>
        <label><input type="radio" name="type" value="seek" ${type === 'seek' ? 'checked' : ''} /><span><b>Torpaq axtarıram</b><small>Mənə uyğun sahə tapın</small></span></label>
      </div>

      <fieldset class="sf-block" data-for="sell">
        <legend><span>1</span>Torpaq haqqında</legend>
        <div class="sf-grid">
          <label class="full">Başlıq<input name="title" maxlength="120" placeholder="Məs: Dağ mənzərəli 10 sot, Qəbələ" /></label>
          <label>Rayon / bölgə *<input name="region" list="sfRegions" maxlength="80" data-req="sell" placeholder="Məs: Abşeron" /></label>
          <label>Kənd / qəsəbə<input name="settlement" maxlength="80" placeholder="Məs: Bilgəh" /></label>
          <label>Təyinat<select name="category">${CATEGORIES.map((c) => `<option>${c}</option>`).join('')}</select></label>
          <label>Sənəd<select name="document">${DOCUMENTS.map((c) => `<option>${c}</option>`).join('')}<option>Sənəd yoxdur</option></select></label>
          <label>Sahə (sot) *<input name="area" type="number" min="0" step="0.1" inputmode="decimal" data-req="sell" /></label>
          <label>Qiymət (₼) *<input name="price" type="number" min="0" step="100" inputmode="numeric" data-req="sell" /><small class="muted" id="perSot"></small></label>
          <fieldset class="full sf-sub"><legend>Kommunikasiya və üstünlüklər</legend>
            <div class="checks">${FEATURES.map((f) => `<label class="chip"><input type="checkbox" name="features" value="${f}" /><span>${f}</span></label>`).join('')}</div>
          </fieldset>
          <label class="full">Sahənin yeri<textarea name="location" rows="2" maxlength="1000" placeholder="Google Maps linki, koordinat (40.5687, 50.0605) və ya ünvanın təsviri"></textarea></label>
          <label class="full">Təsvir<textarea name="description" rows="5" maxlength="4000" placeholder="Relyef, yola çıxış, ətraf, nəyə yararlıdır…"></textarea></label>
          <div class="full">
            <span class="sf-label">Fotolar <small class="muted">(${MAX_PHOTOS} şəklə qədər)</small></span>
            <div class="photos" id="sfPhotos"></div>
            <label class="btn btn-sm btn-outline file-btn" id="sfFileBtn">Şəkil əlavə et<input type="file" accept="image/png,image/jpeg,image/webp" multiple id="sfFile" hidden /></label>
          </div>
        </div>
      </fieldset>

      <fieldset class="sf-block" data-for="seek">
        <legend><span>1</span>Necə torpaq axtarırsınız?</legend>
        <div class="sf-grid">
          <label>Bölgə *<input name="regionSeek" list="sfRegions" maxlength="80" data-req="seek" placeholder="Məs: Abşeron, Qəbələ" /></label>
          <label>Təyinat<select name="categorySeek"><option value="">Fərq etmir</option>${CATEGORIES.map((c) => `<option>${c}</option>`).join('')}</select></label>
          <label>Sahə — min (sot)<input name="areaMin" type="number" min="0" step="0.1" inputmode="decimal" /></label>
          <label>Sahə — max (sot)<input name="areaMax" type="number" min="0" step="0.1" inputmode="decimal" /></label>
          <label>Büdcə — min (₼)<input name="budgetMin" type="number" min="0" step="1000" inputmode="numeric" /></label>
          <label>Büdcə — max (₼)<input name="budgetMax" type="number" min="0" step="1000" inputmode="numeric" /></label>
          <fieldset class="full sf-sub"><legend>Vacib olanlar</legend>
            <div class="checks">${FEATURES.map((f) => `<label class="chip"><input type="checkbox" name="featuresSeek" value="${f}" /><span>${f}</span></label>`).join('')}</div>
          </fieldset>
          <label class="full">Əlavə istəklər<textarea name="note" rows="4" maxlength="3000" placeholder="Məs: ev tikmək üçün, dənizə yaxın, sənədi kupça olsun…"></textarea></label>
        </div>
      </fieldset>
      <datalist id="sfRegions">${regions.map((r) => `<option value="${esc(r)}">`).join('')}</datalist>

      <fieldset class="sf-block">
        <legend><span>2</span>Əlaqə məlumatlarınız</legend>
        <p class="muted small sf-note">Bu məlumatlar saytda göstərilmir — yalnız makler sizinlə əlaqə saxlamaq üçün görür.</p>
        <div class="sf-grid">
          <label>Ad, soyad *<input name="name" maxlength="100" autocomplete="name" data-req="all" /></label>
          <label>Telefon *<input name="phone" type="tel" maxlength="40" autocomplete="tel" placeholder="+994 __ ___ __ __" data-req="all" /></label>
          <label>WhatsApp<input name="whatsapp" type="tel" maxlength="40" placeholder="Telefonla eynidirsə boş saxlayın" /></label>
          <label>E-poçt<input name="email" type="email" maxlength="120" autocomplete="email" /></label>
          <label class="full">Sizə nə vaxt zəng etmək olar?<input name="contactTime" maxlength="100" placeholder="Məs: iş günləri 18:00-dan sonra" /></label>
        </div>
      </fieldset>

      <input name="website" class="hp" tabindex="-1" autocomplete="off" aria-hidden="true" />
      <button class="btn btn-accent btn-block" type="submit" id="sfSend">Göndər</button>
      <p class="muted small center">Göndərməklə məlumatlarınızın makler tərəfindən sizinlə əlaqə üçün istifadəsinə razılıq verirsiniz.</p>
    </form>

    <aside class="submit-side">
      <div class="agent-card">
        <h3>Necə işləyir?</h3>
        <ol class="how" id="how"></ol>
      </div>
      <div class="agent-card">
        <p class="muted small">Sualınız var? Birbaşa yazın:</p>
        <a class="btn btn-wa btn-block" href="${waLink()}" target="_blank" rel="noopener">WhatsApp ilə yaz</a>
        <a class="btn btn-outline btn-block" href="tel:${SITE.phone.replace(/\s/g, '')}">${esc(SITE.phone)}</a>
      </div>
    </aside>
  </section>`;

  const form = $('#sf');
  const el = form.elements;
  const HOW = {
    sell: ['Sahənin məlumatlarını və fotolarını göndərin', 'Makler sizinlə əlaqə saxlayıb məlumatları yoxlayır', 'Sahənin sərhədi xəritədə çəkilir və elan saytda dərc olunur', 'Alıcılardan gələn sorğuları sizə yönləndiririk'],
    seek: ['İstədiyiniz bölgəni, sahəni və büdcəni yazın', 'Makler bazadan uyğun sahələri seçir', 'Sizinlə əlaqə saxlayıb variantları təqdim edirik', 'Baxışa birlikdə gedirik'],
  };

  const sync = () => {
    type = form.querySelector('[name=type]:checked').value;
    form.querySelectorAll('.sf-block[data-for]').forEach((b) => { b.hidden = b.dataset.for !== type; });
    $('#how').innerHTML = HOW[type].map((t) => `<li>${t}</li>`).join('');
    $('#sfSend').textContent = type === 'sell' ? 'Elanı təsdiqə göndər' : 'Axtarış sorğusunu göndər';
    history.replaceState(null, '', type === 'sell' ? '#/elan-yerlesdir' : '#/elan-yerlesdir/axtariram');
  };
  form.addEventListener('change', (e) => { if (e.target.name === 'type') sync(); });
  sync();

  const updPerSot = () => {
    const a = +el.area.value, p = +el.price.value;
    $('#perSot').textContent = a > 0 && p > 0 ? `1 sot: ${Math.round(p / a).toLocaleString('ru-RU').replace(/,/g, ' ')} ₼` : '';
  };
  el.area.addEventListener('input', updPerSot);
  el.price.addEventListener('input', updPerSot);

  // Fotolar
  const drawPhotos = () => {
    $('#sfPhotos').innerHTML = photos.map((p, i) => `<div class="photo"><img src="${esc(p)}" alt="" /><button type="button" data-i="${i}" aria-label="Sil">✕</button>${i === 0 ? '<span>Əsas</span>' : ''}</div>`).join('');
    $('#sfFileBtn').hidden = photos.length >= MAX_PHOTOS;
  };
  $('#sfPhotos').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-i]');
    if (b) { photos.splice(+b.dataset.i, 1); drawPhotos(); }
  });
  $('#sfFile').addEventListener('change', async (e) => {
    const files = [...e.target.files].slice(0, MAX_PHOTOS - photos.length);
    const btn = $('#sfFileBtn');
    btn.classList.add('loading');
    for (const f of files) {
      try { photos.push((await uploadSubmissionImage(f)).url); drawPhotos(); }
      catch (err) { toast(err.message, 'err'); break; }
    }
    btn.classList.remove('loading');
    e.target.value = '';
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const missing = [...form.querySelectorAll('[data-req]')].find((i) => (i.dataset.req === 'all' || i.dataset.req === type) && !i.value.trim());
    if (missing) { missing.focus(); return toast(`Doldurun: ${missing.closest('label').firstChild.textContent.replace('*', '').trim()}`, 'err'); }
    if (el.phone.value.replace(/\D/g, '').length < 7) { el.phone.focus(); return toast('Telefon nömrəsini düzgün yazın', 'err'); }
    const checked = (n) => [...form.querySelectorAll(`[name=${n}]:checked`)].map((i) => i.value);
    const contact = {
      name: el.name.value, phone: el.phone.value, whatsapp: el.whatsapp.value, email: el.email.value,
      contactTime: el.contactTime.value, website: el.website.value,
    };
    const data = type === 'sell'
      ? { type, ...contact, title: el.title.value, region: el.region.value, settlement: el.settlement.value, category: el.category.value,
          document: el.document.value, area: el.area.value, price: el.price.value, features: checked('features'),
          location: el.location.value, description: el.description.value, photos }
      : { type, ...contact, region: el.regionSeek.value, category: el.categorySeek.value, areaMin: el.areaMin.value, areaMax: el.areaMax.value,
          budgetMin: el.budgetMin.value, budgetMax: el.budgetMax.value, features: checked('featuresSeek'), note: el.note.value };
    const btn = $('#sfSend');
    btn.disabled = true;
    btn.textContent = 'Göndərilir…';
    try {
      await submitListing(data);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      form.outerHTML = `<div class="submit-form sf-done">
        <span class="success-ic">✓</span>
        <h2>${type === 'sell' ? 'Elanınız təsdiqə göndərildi' : 'Axtarış sorğunuz qəbul olundu'}</h2>
        <p class="muted">${type === 'sell'
          ? 'Təşəkkür edirik! Makler məlumatları yoxlayıb sizinlə əlaqə saxlayacaq. Təsdiqdən sonra elan saytda dərc olunacaq.'
          : 'Təşəkkür edirik! Uyğun sahələri seçib qısa zamanda sizinlə əlaqə saxlayacağıq.'}</p>
        <div class="sf-done-actions"><a class="btn btn-dark" href="#/elanlar">Elanlara bax</a><a class="btn btn-ghost" href="#/">Ana səhifə</a></div>
      </div>`;
    } catch (err) {
      toast(err.message, 'err');
      btn.disabled = false;
      sync();
    }
  });
}
