# RideTopo

**Rencanakan rute sepeda Anda di Indonesia.**

RideTopo adalah perencana rute sepeda berbasis web (PWA) untuk memahami
jalan dan elevasi sebelum berangkat. Semua perhitungan berjalan di
browser; tidak ada akun, tidak ada server aplikasi, tidak ada pelacakan.

🔗 **[ridetopo.pages.dev](https://ridetopo.pages.dev)**

> **Status: pratinjau publik, belum siap produksi.**
> Seluruh alur rilis pertama sudah lengkap dan terbukti lewat 198 tes
> unit/integrasi serta 109 tes end-to-end. Yang belum: QA pada perangkat
> Android dan iOS sungguhan, serta pengukuran performa lapangan
> (LCP/INP/CLS). Keduanya syarat sebelum produksi.

---

## Apa yang bisa dilakukan

**Menyusun rute.** Tentukan titik mulai dan tujuan lewat pencarian
lokasi, pin di peta, atau lokasi perangkat, lalu tambahkan hingga 20
titik antara yang bisa diurutkan ulang. Batas satu rute 500 km.

**Pulang-pergi.** Aktifkan *Kembali ke titik awal* dan RideTopo mencari
jalan pulang yang berbeda bila tersedia. Kalau tidak tersedia, aplikasi
mengatakannya apa adanya — tidak ada janji "loop tanpa jalan yang sama".

**Membaca medan.** Profil elevasi 30 meter dengan estimasi naik/turun dan
segmentasi menanjak / landai / menurun. Rute di peta ikut berwarna
menurut medan, grafiknya dapat ditelusuri dengan pointer maupun keyboard,
dan posisinya tercermin di peta. Setiap warna selalu punya nama di
legenda — tidak pernah warna saja.

**Meninjau ruas jalan.** Buka *Tinjau ruas jalan* untuk melihat nama,
kelas, dan permukaan tiap ruas, lalu menghindari satu ruas atau satu
koridor. Bisa dipilih dari daftar maupun dengan mengetuk rute di peta.
Kalau rute baru ternyata masih melintasi ruas itu, hasilnya ditolak dan
rute lama dipertahankan.

**Membawa hasilnya keluar.** Ekspor GPX dengan geometri penuh tanpa
penyederhanaan, atau buat kartu gambar Story 1080×1920 tanpa basemap
lengkap dengan atribusi OpenStreetMap.

**Offline.** Satu draf rute terakhir tersimpan di perangkat. Saat
offline, ringkasan, grafik, GPX, dan kartu gambar tetap dapat dibuka;
pencarian, perutean, dan tile baru dinyatakan tidak tersedia dengan
jelas.

## Prinsip

- **Rute pertama adalah keluaran mesin apa adanya.** Tidak ada klaim
  "paling aman" atau penilaian keselamatan jalan.
- **Preferensi bukan jaminan.** *Jalan Kecil* dan *Lebih Landai*
  menggeser preferensi mesin, dan teksnya mengatakan begitu.
- **Kegagalan tidak menghapus rute.** Perhitungan ulang yang gagal
  mempertahankan hasil valid terakhir beserta ekspornya.
- **Tanpa presisi palsu.** Elevasi dibulatkan dan selalu berlabel
  estimasi; ketika datanya tidak menutup seluruh rute, totalnya
  disembunyikan alih-alih ditebak.
- **Privasi lokal.** Satu draf di perangkat Anda, tanpa akun dan tanpa
  sinkronisasi.

## Di luar cakupan saat ini

Tidak ada navigasi belok-per-belok, live traffic, cuaca, akun,
sinkronisasi cloud, peta offline, atau mode gravel/MTB. Handoff ke Google
Maps, berbagi lewat URL, kartu gambar dengan basemap, dan mode gelap
direncanakan setelah rilis pertama stabil.

## Arsitektur

Aplikasi **statis** React + TypeScript di Cloudflare Pages. Tidak ada
backend milik RideTopo — browser berbicara langsung ke penyedia layanan.

```
Browser ──> /config.json
   ├──> Valhalla        rute, elevasi, metadata ruas jalan
   ├──> Nominatim       pencarian lokasi (submit-only, khusus Indonesia)
   └──> OpenFreeMap     tile peta dasar
```

Penyedia berada di belakang adapter yang menormalkan respons, sehingga
bentuk data mentah tidak pernah masuk ke UI. Satu lapisan orkestrasi
menghubungkan aksi pengguna; store Zustand memisahkan state formulir dari
rute valid terakhir; modul domain murni menghitung rute, pulang-pergi,
elevasi, penghindaran, GPX, dan gambar.

| Area | Pilihan |
|---|---|
| Framework | React 18, TypeScript strict, Vite |
| Peta | MapLibre GL JS |
| State | Zustand |
| Penyimpanan | IndexedDB (draf), localStorage (preferensi ringan) |
| Grafik elevasi | SVG kustom |
| PWA | vite-plugin-pwa / Workbox |
| Uji | Vitest, Testing Library, Playwright, axe |
| Hosting | Cloudflare Pages, statis sepenuhnya |

## Menjalankan secara lokal

Butuh Node sesuai [`.node-version`](./.node-version).

```bash
npm ci
npm run dev
```

Buka http://localhost:5173.

Untuk uji end-to-end, pasang browsernya lebih dulu:

```bash
npm run browsers:install
```

## Perintah

| Perintah | Deskripsi |
|---|---|
| `npm run dev` | Server pengembangan Vite |
| `npm run build` | Build produksi ke `dist/` |
| `npm run preview` | Pratinjau build produksi |
| `npm run lint` | ESLint, tanpa toleransi peringatan |
| `npm run typecheck` | TypeScript strict |
| `npm run test` | Unit dan integrasi (Vitest) |
| `npm run test:e2e` | End-to-end, matriks penuh |
| `npm run test:e2e:ci` | Subset yang dapat dijalankan GitHub Actions |
| `npm run test:a11y` | Pemeriksaan aksesibilitas saja |
| `npm run build:icons` | Generate ikon PWA dari master SVG |
| `npm run verify:build` | Inspeksi keluaran build |
| `npm run check:public` | Pemeriksaan higienitas repositori |
| `npm run audit:security` | Gate kerentanan dependency |
| `npm run verify` | Semua pemeriksaan, berurutan |

### Catatan matriks browser

`npm run test:e2e` menjalankan Chromium, Firefox, dan WebKit, ditambah
proyek `firefox-no-webgl` yang membuktikan aplikasi tetap dapat dipakai
pada browser tanpa WebGL sama sekali.

Runner GitHub Actions tidak punya GPU dan tidak dapat memberi MapLibre
konteks WebGL di Firefox headless, jadi CI menjalankan `test:e2e:ci`
(Chromium, WebKit, dan proyek tanpa-WebGL). **Matriks penuh dijalankan
lokal dan wajib lolos sebelum rilis.**

## Konfigurasi runtime

[`public/config.json`](./public/config.json) menentukan endpoint penyedia
layanan dan divalidasi dengan Zod sebelum dipakai:

```json
{
  "version": 1,
  "valhallaBaseUrl": "https://valhalla.example.com",
  "nominatimBaseUrl": "https://nominatim.openstreetmap.org",
  "basemapStyleUrl": "https://tiles.openfreemap.org/styles/liberty",
  "geocodingEnabled": true
}
```

Berkas ini tidak pernah di-cache permanen, sehingga endpoint dapat
diganti tanpa build ulang. `geocodingEnabled: false` mematikan pencarian
lokasi tanpa mengganggu pin peta dan GPS. Tidak ada kredensial di sini —
seluruh isinya publik.

Perutean memakai instans Valhalla mandiri. Instans mana pun bisa dipakai
selama mengizinkan permintaan lintas asal dari domain Anda dan graph-nya
dibangun dengan data elevasi.

## Deployment

Cloudflare Pages, perintah build `npm run build`, direktori keluaran
`dist/`. [`public/_headers`](./public/_headers) mengatur cache dan header
keamanan termasuk CSP; [`public/_redirects`](./public/_redirects)
menyediakan fallback SPA. Tidak ada Worker, Pages Function, D1, KV, atau
R2.

## Aksesibilitas

Target WCAG 2.2 AA: target sentuh minimum 44 × 44 px, dapat dipakai mulai
lebar 320 px, fokus terlihat dan terkelola di dalam dialog, makna medan
selalu berlabel, dan setiap fungsi peta punya alternatif berbasis daftar
atau tombol. Pemeriksaan axe berjalan di CI.

## Privasi

RideTopo mengirim kueri pencarian ke Nominatim, koordinat rute ke
Valhalla, dan permintaan tile ke OpenFreeMap. Satu draf rute disimpan di
perangkat Anda dan dapat dihapus kapan saja. Kartu gambar dirender lokal
dan tidak pernah diunggah. Tidak ada akun, analitik, iklan, session
replay, pelacakan lintas situs, atau cookie non-esensial. Rinciannya ada
di halaman Privasi dalam aplikasi.

## Atribusi

- **Data rute:** © OpenStreetMap contributors —
  [openstreetmap.org/copyright](https://openstreetmap.org/copyright)
- **Mesin rute:** [Valhalla](https://github.com/valhalla/valhalla)
- **Elevasi:** graph elevasi Valhalla (Mapzen Terrain Tiles / SRTM)
- **Peta dasar:** [OpenFreeMap](https://openfreemap.org), gaya Liberty
- **Font:** Plus Jakarta Sans, SIL Open Font License, di-host sendiri

## Keamanan

Laporkan kerentanan sesuai [SECURITY.md](./SECURITY.md): buka issue dan
beri label `security`, tanpa menyertakan detail proof-of-concept
sensitif di sana — kanal tindak lanjut yang aman akan disediakan.

## Lisensi

[AGPL-3.0](./LICENSE). Lisensi data dan dependency mengikuti sumbernya
masing-masing.
