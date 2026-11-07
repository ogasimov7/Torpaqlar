# Torpaqlar — torpaq makleri üçün 3D xəritəli sayt

## İşə salmaq

```bash
cd torpaq-makler
npm start          # və ya: node server.js
```

Brauzerdə: http://localhost:3000

Lokalda heç bir paket quraşdırmaq lazım deyil (Node.js 18+ kifayətdir).

## Səhifələr

| Ünvan | Nə var |
|---|---|
| `#/` | Ana səhifə: fonda fırlanan peyk görüntüsü, axtarış, seçilmiş elanlar, “Bilgəh Bağları” massivinin planı, bölgələr |
| `#/elanlar` | Bütün elanlar, filtrlər (bölgə, təyinat, qiymət, sahə, status) və sıralama |
| `#/elan/1001` | Elanın səhifəsi: peyk qalereyası, xüsusiyyətlər, təsvir, sorğu forması, WhatsApp/zəng |
| `#/elaqe` | Əlaqə və müraciət forması (WhatsApp-a göndərir) |
| `#/admin` | CRM panel (sol sidebar): icmal, elanlar, müraciətlər, müştərilər, tapşırıqlar, qeyd dəftəri, 3D xəritə |

## CRM panel

| Bölmə | Ünvan | Nə var |
|---|---|---|
| İcmal | `#/admin` | Göstəricilər, son müraciətlər, yaxın tapşırıqlar, müraciət mərhələləri, ən çox sorğu alan elanlar, sürətli əlavə düymələri |
| Elanlar | `#/admin/elanlar` | Elanların siyahısı (sorğu sayı ilə), yeni elan, redaktə |
| Müraciətlər | `#/admin/muracietler` | Saytdan gələn sorğular + əl ilə əlavə olunanlar; status mərhələləri, zəng/WhatsApp, “Müştəri” düyməsi ilə müştəriyə çevirmə |
| Müştərilər | `#/admin/musteriler` | Müştəri bazası; müştəri kartında məlumat, maraqlandığı elanlar, qeydlər, tapşırıqlar, müraciətlər |
| Tapşırıqlar | `#/admin/tapsiriqlar` | Zəng, görüş, baxış — gecikmiş / bu gün / sabah / bu həftə üzrə qruplaşdırılır |
| Qeyd dəftəri | `#/admin/qeydler` | Sərbəst qeydlər: rəng, sabitləmə, müştəriyə və ya elana bağlama |
| 3D Xəritə | `#/admin/xerite` | Bütün elanlar status rəngi ilə; sahəni seçib statusu dəyişmək, müraciətlərinə baxmaq |

- Saytda hər elanın səhifəsində **“Sorğu göndər”** forması var; əlaqə forması da müraciəti panelə yazır (`POST /api/inquiry`).
- CRM məlumatları lokalda `data/leads.json`, `data/clients.json`, `data/tasks.json`, `data/notes.json` fayllarındadır (git-ə düşmür), Vercel-də isə Blob-dadır.

## Elan redaktoru

| Link | Nə açır |
|---|---|
| http://localhost:3000/elan-elave | Birbaşa **yeni elan** forması |
| http://localhost:3000/admin | CRM panel |

- Açar: `makler2026` (dəyişmək üçün: `ADMIN_KEY=yeni_acar npm start`). Brauzer tabı bağlananda yenidən açar soruşulur.
- **Sahənin yeri** üç yolla daxil edilir (hamısı bir-biri ilə sinxrondur):
  1. **Koordinatlarla** — hər sətirdə bir künc: `40.5687, 50.0605`. `40°34'07"N 50°03'38"E` formatı və Google Maps linki də qəbul olunur. “Xəritəyə tətbiq et” basın.
  2. **Xəritədə çəkməklə** — “Xəritədə çək” → künclərə klikləyin → 1-ci nöqtəyə klikləyib bitirin. Nöqtələri sürüşdürüb düzəltmək olar.
  3. **Mərkəz nöqtə + ölçü** — yalnız 1 koordinat yazın, “Sahə (sot)” xanasını doldurun və “Mərkəzdən kvadrat qur” basın.
- **Statusu dəyişmək** (Satışda / Rezerv / Satılıb): `/admin` cədvəlində elanın sətrindəki status düyməsindən seçin — dərhal yadda qalır. Və ya “Redaktə” → “Status” xanası → “Yadda saxla”.
- Sahə sot ilə avtomatik hesablanır, 1 sotun qiyməti göstərilir.
- Foto yüklənməsə, peyk görüntüsü və sahənin konturu avtomatik şəkil kimi göstərilir.

## Vercel-də

- `api/index.js` — bütün `/api/*` sorğularını işləyən funksiya; məntiq `lib/core.js`-dədir (lokal `server.js` də onu işlədir).
- Elanlar və yüklənən fotolar **Vercel Blob**-da saxlanılır (`BLOB_READ_WRITE_TOKEN`). Blob boşdursa, `data/listings.json`-dakı elanlar göstərilir; ilk dəyişiklikdən sonra hamısı Blob-a yazılır.
- Admin açarı **`ADMIN_KEY`** mühit dəyişəni ilə verilir (Vercel → Project → Settings → Environment Variables). Verilməyibsə admin bağlıdır. Dəyişdikdən sonra yenidən deploy edin.
- `main` budağına push → avtomatik deploy.

## Fayllar

- `public/js/config.js` — maklerin adı, telefonu, WhatsApp nömrəsi, e-poçtu (**bunları öz məlumatlarınızla dəyişin**)
- `data/listings.json` — bütün elanlar (lokalda admin paneldən dəyişir; Vercel-də ilkin məlumatdır)
- `public/uploads/` — yüklənmiş şəkillər
- `scripts/seed.js` — nümunə məlumatları yenidən yaradır (`npm run seed` — **mövcud elanların üstünə yazır!**)

## Qeyd

- Nümunə elanlar demo üçündür: koordinatlar təxmini seçilib, bəzi sahələr real tikililərin üstünə düşür. Öz elanlarınızı admin paneldən əlavə edib nümunələri silin.
- Xəritə xidmətləri: Esri World Imagery (peyk), AWS Terrain Tiles (relyef), Esri World Street Map (adi xəritə), MapLibre GL JS 5.9. Canlı (production) istifadədə Esri-nin istifadə şərtlərini yoxlayın və ya MapTiler/Mapbox açarı ilə əvəz edin.
