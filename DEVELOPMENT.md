# Pengembangan

Catatan teknis untuk menjalankan, menguji, dan menyebarkan RideTopo.
Penjelasan produknya ada di [README](./README.md).

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

Perjalanan offline (`offline-export.spec.ts`) tidak dijalankan di WebKit.
Spec itu membutuhkan service worker yang hidup, sementara Playwright hanya
mencegat permintaan service worker di Chromium — di WebKit mock-nya
ditembus dan tesnya akan memanggil layanan rute sungguhan. Chromium dan
Firefox menutupi alur tersebut; perilaku offline Safari termasuk dalam QA
perangkat yang masih menjadi gate terbuka sebelum produksi.

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
`dist/`. Branch produksinya `main`, yang juga branch default repositori —
keduanya harus tetap sama, karena me-merge ke branch lain tidak akan
menayangkan apa pun.

[`public/_headers`](./public/_headers) mengatur cache dan header keamanan
termasuk CSP; [`public/_redirects`](./public/_redirects) menyediakan
fallback SPA. Tidak ada Worker, Pages Function, D1, KV, atau R2.

Service worker memakai `registerType: "autoUpdate"`, sehingga rilis baru
mengambil alih sendiri di kunjungan berikutnya. `/sw.js` dan
`/registerSW.js` disajikan `no-cache`; skrip worker yang basi akan
mengunci aplikasi ke build lama. `npm run verify:build` menjaga keempat
properti itu.

## Aksesibilitas

Target WCAG 2.2 AA: target sentuh minimum 44 × 44 px, dapat dipakai mulai
lebar 320 px, fokus terlihat dan terkelola di dalam dialog, makna medan
selalu berlabel, dan setiap fungsi peta punya alternatif berbasis daftar
atau tombol. Pemeriksaan axe berjalan di CI.
