// Nümunə elanları yaradır: node scripts/seed.js
// Hər elan üçün sahənin ölçüsünə uyğun real koordinatlarda poliqon qurulur.
const fs = require('fs');
const path = require('path');

let s = 20261024;
const rnd = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;

const toLL = (lat, lon, dx, dy) => [
  +(lon + dx / (111320 * Math.cos((lat * Math.PI) / 180))).toFixed(7),
  +(lat + dy / 110540).toFixed(7),
];

function plot(lat, lon, sot, aspect = 1.5, rot = 0, jitter = 0.06) {
  const area = sot * 100;
  const w = Math.sqrt(area / aspect);
  const l = w * aspect;
  const r = (rot * Math.PI) / 180;
  const ring = [[-l / 2, -w / 2], [l / 2, -w / 2], [l / 2, w / 2], [-l / 2, w / 2]].map(([x, y]) => {
    x *= 1 + (rnd() - 0.5) * jitter;
    y *= 1 + (rnd() - 0.5) * jitter;
    return toLL(lat, lon, x * Math.cos(r) - y * Math.sin(r), x * Math.sin(r) + y * Math.cos(r));
  });
  return [...ring, ring[0]];
}

const FEATURE_TEXT = {
  'Su': 'su xətti sahəyə qədər çəkilib',
  'İşıq': 'elektrik xətti yaxından keçir',
  'Qaz': 'qaz xətti mövcuddur',
  'Asfalt yol': 'asfalt yolla birbaşa giriş var',
  'Dəniz mənzərəsi': 'sahədən dəniz görünür',
  'Dağ mənzərəsi': 'ətrafı dağ mənzərəlidir',
  'Meşəyə yaxın': 'meşə zolağına bir neçə dəqiqəlik məsafədədir',
  'Hasarlanıb': 'sahənin ətrafı hasarlanıb',
  'Ağaclar var': 'sahədə meyvə ağacları var',
  'Magistral kənarı': 'magistral yolun kənarında yerləşir',
  'Çaya yaxın': 'yaxınlıqdan çay axır',
};

function describe(l) {
  const f = l.features.map((x) => FEATURE_TEXT[x]).filter(Boolean);
  return `${l.intro}\n\nSahə ${l.area} sot (${(l.area / 100).toLocaleString('az')} ha) təşkil edir, sənəd — ${l.document.toLowerCase()}. ${
    f.length ? 'Kommunikasiya və üstünlüklər: ' + f.join(', ') + '.' : ''
  }\n\nBaxış üçün əvvəlcədən zəng edin — sahəyə birlikdə gedib sərhədləri yerində göstəririk. Sənədlərin yoxlanılması və alqı-satqı prosesində tam hüquqi dəstək veririk.`;
}

const L = [
  { title: 'Dağ mənzərəli torpaq, Vəndam', region: 'Qəbələ', settlement: 'Vəndam', at: [40.9465, 47.9330], area: 25, price: 62500, category: 'Fərdi yaşayış', status: 'available', document: 'Kupça (Çıxarış)', features: ['Su', 'İşıq', 'Qaz', 'Asfalt yol', 'Dağ mənzərəsi'], dist: { city: 12 }, featured: true, rot: 20,
    intro: 'Vəndam kəndinin yuxarı hissəsində, Qafqaz dağlarına açılan geniş mənzərəsi olan sakit sahə. Villa və ya kiçik qonaq evi üçün idealdır.' },
  { title: 'Otel layihəsi üçün 1.2 ha, Nohurqışlaq', region: 'Qəbələ', settlement: 'Nohurqışlaq', at: [41.0335, 47.8060], area: 120, price: 210000, category: 'İnvestisiya', status: 'available', document: 'Kupça (Çıxarış)', features: ['Su', 'İşıq', 'Asfalt yol', 'Dağ mənzərəsi', 'Meşəyə yaxın'], dist: { city: 8 }, featured: true, rot: -15, aspect: 1.3,
    intro: 'Nohur gölünə yaxın turizm zonasında böyük sahə. Butik otel, istirahət kompleksi və ya kotec şəhərciyi üçün uyğundur.' },
  { title: 'Meşə kənarında sahə, Qəçrəş', region: 'Quba', settlement: 'Qəçrəş', at: [41.3700, 48.3800], area: 18, price: 39600, category: 'Bağ evi', status: 'available', document: 'Kupça (Çıxarış)', features: ['Su', 'İşıq', 'Meşəyə yaxın', 'Dağ mənzərəsi'], dist: { city: 11 }, rot: 35,
    intro: 'Qəçrəş meşəsinin kənarında, təmiz havası və sərin yayı ilə seçilən ərazidə bağ evi üçün sahə.' },
  { title: 'Kommersiya sahəsi, Quba mərkəzi yol', region: 'Quba', settlement: 'Quba şəhəri', at: [41.3600, 48.5150], area: 8, price: 96000, category: 'Kommersiya', status: 'reserved', document: 'Kupça (Çıxarış)', features: ['Su', 'İşıq', 'Qaz', 'Asfalt yol', 'Magistral kənarı'], dist: { city: 1 }, rot: 10, aspect: 1.8,
    intro: 'Şəhərin əsas giriş yolunun üstündə, mağaza, kafe və ya xidmət obyekti üçün yüksək axınlı yer.' },
  { title: 'Şahdağ yolunda geniş sahə', region: 'Qusar', settlement: 'Qusar', at: [41.4050, 48.4150], area: 40, price: 72000, category: 'Fərdi yaşayış', status: 'available', document: 'Kupça (Çıxarış)', features: ['Su', 'İşıq', 'Asfalt yol', 'Dağ mənzərəsi', 'Çaya yaxın'], dist: { city: 3 }, featured: true, rot: -25,
    intro: 'Şahdağ turizm kompleksinə gedən yolun yaxınlığında, Şahdağ zirvəsinə baxan sahə.' },
  { title: 'Pirqulu meşəsi yanında torpaq', region: 'Şamaxı', settlement: 'Pirqulu', at: [40.7350, 48.6050], area: 30, price: 45000, category: 'Bağ evi', status: 'available', document: 'Bələdiyyə sənədi', features: ['İşıq', 'Meşəyə yaxın', 'Dağ mənzərəsi'], dist: { city: 14 }, rot: 5,
    intro: 'Pirqulu rəsədxanasına yaxın, yüksəklikdə yerləşən, yayda sərin və mənzərəli sahə.' },
  { title: 'Üzümlük üçün 2 ha, Mədrəsə', region: 'Şamaxı', settlement: 'Mədrəsə', at: [40.5950, 48.5350], area: 200, price: 80000, category: 'Kənd təsərrüfatı', status: 'available', document: 'Kupça (Çıxarış)', features: ['Su', 'İşıq', 'Asfalt yol'], dist: { city: 9 }, rot: 40, aspect: 2,
    intro: 'Məşhur Mədrəsə üzüm bağları zonasında, şərabçılıq və ya bağçılıq üçün münbit torpaq.' },
  { title: 'Lahıc yolunda bağ sahəsi', region: 'İsmayıllı', settlement: 'Talıstan', at: [40.8100, 48.2500], area: 15, price: 27000, category: 'Bağ evi', status: 'sold', document: 'Kupça (Çıxarış)', features: ['Su', 'İşıq', 'Ağaclar var', 'Dağ mənzərəsi'], dist: { city: 6 }, rot: -10,
    intro: 'Lahıca gedən yolun üstündə, qoz və alma ağacları olan bağ sahəsi.' },
  { title: 'Kiş kəndində tarixi məhəllədə torpaq', region: 'Şəki', settlement: 'Kiş', at: [41.2250, 47.1900], area: 12, price: 33600, category: 'Fərdi yaşayış', status: 'available', document: 'Kupça (Çıxarış)', features: ['Su', 'İşıq', 'Qaz', 'Dağ mənzərəsi'], dist: { city: 5 }, rot: 15,
    intro: 'Qədim Kiş məbədinə yaxın, turist marşrutunun üstündə ev və ya qonaq evi üçün sahə.' },
  { title: 'Çay plantasiyası üçün 3 ha', region: 'Lənkəran', settlement: 'Haftoni', at: [38.7300, 48.8000], area: 300, price: 96000, category: 'Kənd təsərrüfatı', status: 'available', document: 'Kupça (Çıxarış)', features: ['Su', 'İşıq', 'Çaya yaxın'], dist: { city: 7 }, rot: 25, aspect: 1.6,
    intro: 'Subtropik iqlim zonasında, çay və sitrus bitkiləri üçün yararlı geniş kənd təsərrüfatı sahəsi.' },
  { title: 'Göygöl yolunda yaşayış sahəsi', region: 'Göygöl', settlement: 'Göygöl şəhəri', at: [40.5900, 46.3300], area: 20, price: 30000, category: 'Fərdi yaşayış', status: 'available', document: 'Kupça (Çıxarış)', features: ['Su', 'İşıq', 'Qaz', 'Asfalt yol'], dist: { city: 2 }, rot: -30,
    intro: 'Göygöl Milli Parkına gedən yolun yaxınlığında, rahat əlaqəli yaşayış sahəsi.' },
  { title: 'Xızı dağlarında ferma sahəsi', region: 'Xızı', settlement: 'Xızı', at: [40.9150, 49.0700], area: 50, price: 40000, category: 'Kənd təsərrüfatı', status: 'reserved', document: 'Bələdiyyə sənədi', features: ['İşıq', 'Dağ mənzərəsi'], dist: { city: 4 }, rot: 0,
    intro: 'Qırmızı qumlu dağların fonunda, heyvandarlıq və ya eko-turizm üçün geniş sahə.' },
  { title: 'Nabran meşəsində istirahət sahəsi', region: 'Xaçmaz', settlement: 'Nabran', at: [41.7900, 48.6350], area: 22, price: 132000, category: 'İnvestisiya', status: 'available', document: 'Kupça (Çıxarış)', features: ['Su', 'İşıq', 'Asfalt yol', 'Meşəyə yaxın'], dist: { sea: 2.5 }, featured: true, rot: 45,
    intro: 'Nabranın meşəlik istirahət zonasında, kotec və ya istirahət mərkəzi üçün uyğun sahə.' },
  { title: 'Mərdəkanda bağ sahəsi', region: 'Abşeron', settlement: 'Mərdəkan', at: [40.4950, 50.1400], area: 6, price: 66000, category: 'Bağ evi', status: 'available', document: 'Kupça (Çıxarış)', features: ['Su', 'İşıq', 'Qaz', 'Asfalt yol', 'Ağaclar var'], dist: { sea: 2, city: 30 }, rot: 12,
    intro: 'Mərdəkanın köhnə bağlar zonasında, əncir və tut ağacları olan, yaşayış üçün hazır sahə.' },
  { title: 'Dənizə yaxın torpaq, Şüvəlan', region: 'Abşeron', settlement: 'Şüvəlan', at: [40.4885, 50.2000], area: 10, price: 120000, category: 'Fərdi yaşayış', status: 'available', document: 'Kupça (Çıxarış)', features: ['Su', 'İşıq', 'Qaz', 'Asfalt yol', 'Dəniz mənzərəsi'], dist: { sea: 0.6, city: 35 }, featured: true, rot: -8,
    intro: 'Şüvəlan çimərliyinə piyada məsafədə, yay evi və ya daimi yaşayış üçün sahə.' },
  { title: 'Buzovnada yaşayış sahəsi', region: 'Abşeron', settlement: 'Buzovna', at: [40.5080, 50.1100], area: 8, price: 56000, category: 'Fərdi yaşayış', status: 'sold', document: 'Kupça (Çıxarış)', features: ['Su', 'İşıq', 'Qaz', 'Asfalt yol'], dist: { sea: 1.2, city: 28 }, rot: 30,
    intro: 'Buzovnanın sakit küçəsində, bütün kommunikasiyaları olan hazır sahə.' },
  { title: 'Nardaranda dəniz kənarı sahə', region: 'Abşeron', settlement: 'Nardaran', at: [40.5520, 49.9950], area: 12, price: 108000, category: 'Fərdi yaşayış', status: 'available', document: 'Kupça (Çıxarış)', features: ['Su', 'İşıq', 'Asfalt yol', 'Dəniz mənzərəsi'], dist: { sea: 1.5, city: 25 }, rot: -20,
    intro: 'Sürətlə inkişaf edən şimal sahilində, yeni kurort layihələrinə yaxın sahə.' },
  { title: 'Pirşağıda bağ sahəsi', region: 'Abşeron', settlement: 'Pirşağı', at: [40.5480, 49.8850], area: 7, price: 49000, category: 'Bağ evi', status: 'available', document: 'Kupça (Çıxarış)', features: ['Su', 'İşıq', 'Hasarlanıb'], dist: { sea: 1.8, city: 22 }, rot: 18,
    intro: 'Hasarlanmış, düz relyefli bağ sahəsi — dərhal tikintiyə başlamaq olar.' },
  { title: 'Novxanıda yaşayış sahəsi', region: 'Abşeron', settlement: 'Novxanı', at: [40.5280, 49.7950], area: 9, price: 72000, category: 'Fərdi yaşayış', status: 'reserved', document: 'Kupça (Çıxarış)', features: ['Su', 'İşıq', 'Qaz', 'Asfalt yol'], dist: { sea: 1.5, city: 25 }, rot: -35,
    intro: 'Novxanının yeni yaşayış massivində, məktəb və marketlərə yaxın sahə.' },
  { title: 'Magistral kənarı kommersiya, Masazır', region: 'Abşeron', settlement: 'Masazır', at: [40.4780, 49.7720], area: 15, price: 180000, category: 'Kommersiya', status: 'available', document: 'Kupça (Çıxarış)', features: ['Su', 'İşıq', 'Qaz', 'Asfalt yol', 'Magistral kənarı'], dist: { city: 15 }, featured: true, rot: 22, aspect: 2.2,
    intro: 'Bakı–Sumqayıt istiqamətində yoğun nəqliyyat axını olan yolun kənarında, anbar, ticarət mərkəzi və ya avtosalon üçün.' },
  { title: 'Türkanda bağ sahəsi', region: 'Abşeron', settlement: 'Türkan', at: [40.3760, 50.2050], area: 6, price: 33000, category: 'Bağ evi', status: 'available', document: 'Bələdiyyə sənədi', features: ['Su', 'İşıq'], dist: { sea: 1, city: 30 }, rot: 8,
    intro: 'Türkanın sahilə yaxın hissəsində, sərfəli qiymətə bağ sahəsi.' },
  { title: 'Sənaye zonasında 1 ha, Hövsan', region: 'Abşeron', settlement: 'Hövsan', at: [40.3830, 50.0700], area: 100, price: 250000, category: 'Kommersiya', status: 'available', document: 'Kupça (Çıxarış)', features: ['Su', 'İşıq', 'Qaz', 'Asfalt yol', 'Hasarlanıb'], dist: { city: 20 }, rot: -12, aspect: 1.4,
    intro: 'Logistika, anbar və ya istehsal sahəsi üçün yararlı, hasarlanmış böyük ərazi.' },
  { title: 'Qala qəsəbəsində torpaq', region: 'Abşeron', settlement: 'Qala', at: [40.4380, 50.1650], area: 10, price: 45000, category: 'Fərdi yaşayış', status: 'available', document: 'Kupça (Çıxarış)', features: ['Su', 'İşıq', 'Qaz'], dist: { city: 32 }, rot: 0,
    intro: 'Tarixi Qala qoruğuna yaxın, sakit qəsəbədə yaşayış üçün sahə.' },
];

const now = Date.now();
let id = 1000;
const listings = L.map((l, i) => {
  const item = {
    id: String(++id),
    title: l.title,
    region: l.region,
    settlement: l.settlement,
    category: l.category,
    area: l.area,
    price: l.price,
    status: l.status,
    document: l.document,
    features: l.features,
    distances: l.dist,
    featured: !!l.featured,
    description: describe(l),
    polygon: plot(l.at[0], l.at[1], l.area, l.aspect || 1.5, l.rot || 0),
    photos: [],
    createdAt: new Date(now - i * 86400000 * 1.7).toISOString(),
  };
  return item;
});

// "Bilgəh Bağları" massivi — seabreeze tərzində parselləşdirilmiş layihə (2 cərgə x 7 sahə)
const M = { lat: 40.5687, lon: 50.0605, rot: 95 };
const lotW = 22, lotD = 32, road = 12;
const statuses = ['sold', 'available', 'available', 'reserved', 'available', 'sold', 'available', 'available', 'available', 'reserved', 'available', 'sold', 'available', 'available'];
const r = (M.rot * Math.PI) / 180;
let n = 0;
for (let row = 0; row < 2; row++) {
  for (let col = 0; col < 7; col++) {
    const x0 = (col - 3.5) * (lotW + 1.5);
    const y0 = row === 0 ? road / 2 : -road / 2 - lotD;
    const corners = [[x0, y0], [x0 + lotW, y0], [x0 + lotW, y0 + lotD], [x0, y0 + lotD]];
    const ring = corners.map(([x, y]) => toLL(M.lat, M.lon, x * Math.cos(r) - y * Math.sin(r), x * Math.sin(r) + y * Math.cos(r)));
    ring.push(ring[0]);
    const area = Math.round((lotW * lotD) / 100 * 10) / 10;
    const corner = col === 0 || col === 6;
    const price = Math.round((corner ? 8200 : 7600) * area / 100) * 100;
    n++;
    const status = statuses[n - 1];
    const base = {
      area, document: 'Kupça (Çıxarış)',
      features: ['Su', 'İşıq', 'Qaz', 'Asfalt yol', 'Hasarlanıb'],
      intro: `“Bilgəh Bağları” qapalı massivində ${n} nömrəli sahə${corner ? ' (künc sahə)' : ''}. Massivdə daxili asfalt yollar, mühafizə və ortaq kommunikasiya xətləri çəkilib.`,
    };
    listings.push({
      id: String(++id),
      title: `Bilgəh Bağları — sahə №${n}`,
      region: 'Abşeron',
      settlement: 'Bilgəh',
      category: 'Fərdi yaşayış',
      area,
      price,
      status,
      document: base.document,
      features: base.features,
      distances: { sea: 1.3, city: 30 },
      featured: n === 4 || n === 9,
      project: 'Bilgəh Bağları',
      lot: n,
      description: describe(base),
      polygon: ring,
      photos: [],
      createdAt: new Date(now - (L.length + n) * 86400000).toISOString(),
    });
  }
}

const out = path.join(__dirname, '..', 'data', 'listings.json');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(listings, null, 2));
console.log(`${listings.length} elan yazıldı → ${out}`);
