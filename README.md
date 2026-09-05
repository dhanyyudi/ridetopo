# RideTopo

Rencanakan rute sepeda Anda di Indonesia.

RideTopo adalah perencana rute sepeda berbasis web (PWA) yang mendukung
rute titik-ke-titik dan pulang-pergi, analisis elevasi, tinjauan ruas
jalan, ekspor GPX, dan berbagi gambar rute.

## Status

P0 telah diimplementasikan secara lengkap pada branch lokal
`fix/audit-remediation-2026-09`. Audit menyeluruh 5 September 2026
menemukan dan menutup lima temuan blocker serta sepuluh temuan major,
masing-masing dengan tes regresi. Seluruh perjalanan pengguna terbukti
lewat 190 tes unit/integrasi dan 105 tes E2E (35 kasus × Chromium,
Firefox, WebKit).

**Belum production-ready.** Yang masih terbuka: QA perangkat Android dan
iOS, serta pengukuran LCP/INP/CLS di perangkat nyata. Lihat
[audit/implementation-evidence.md](./audit/implementation-evidence.md)
untuk detail lengkap.

## Fitur P0

- **Perencanaan rute** titik-ke-titik dengan hingga 20 titik antara
- **Pencarian lokasi** (Nominatim, submit-only, khusus Indonesia),
  pin peta, dan lokasi perangkat untuk titik mulai
- **Rute pulang-pergi** dengan dua mode: *Lewat jalan lain* (default)
  dan *Pulang tercepat*
- **Analisis elevasi** 30 m: interpolasi terbatas, median filter,
  gain/loss, dan klasifikasi medan (menanjak/landai/menurun) dengan
  legenda bernama serta kursor grafik yang tercermin di peta
- **Tinjauan ruas jalan** dengan nama, kelas, permukaan, dan
  penghindaran ruas/koridor eksplisit
- **Ekspor GPX** dengan geometri lengkap tanpa penyederhanaan
- **Gambar Story** 1080×1920 tanpa basemap dengan preview, Web Share,
  dan fallback unduh PNG
- **Satu draf lokal** dengan konfirmasi pemulihan dan penghapusan;
  preferensi sepeda/jalan/medan diingat di `localStorage`
- **Dukungan offline**: shell, draf, GPX, dan gambar tanpa basemap
- PWA yang dapat dipasang dengan ikon dan font self-hosted

## Memulai (Lokal)

```bash
npm ci
npm run dev
```

Buka http://localhost:5173 di browser.

## Perintah

| Perintah | Deskripsi |
|---|---|
| `npm run dev` | Server pengembangan Vite |
| `npm run build` | Build produksi ke `dist/` |
| `npm run preview` | Pratinjau build produksi |
| `npm run build:icons` | Generate raster icon PWA dari master SVG |
| `npm run verify:build` | Inspeksi build output (asset, CSP, secrets) |
| `npm run browsers:install` | Pasang browser Playwright |
| `npm run lint` | ESLint (max-warnings=0) |
| `npm run typecheck` | TypeScript type check |
| `npm run test` | Unit dan integrasi test |
| `npm run test:e2e` | Playwright end-to-end (Chromium, Firefox, WebKit) |
| `npm run check:public` | Pemeriksaan keamanan repositori |
| `npm run audit:security` | Audit dependency (high/critical gate) |
| `npm run verify` | Semua pemeriksaan |

## Arsitektur

RideTopo adalah aplikasi **statis** React/TypeScript SPA yang dihosting
di Cloudflare Pages. Tidak ada backend server — semua komputasi
dilakukan di browser.

```
Browser → /config.json → Nominatim, Valhalla, OpenFreeMap
```

Provider eksternal berada di belakang adapter yang ter-normalisasi.
Satu lapisan orkestrasi (`use-route-planner-controller`) menghubungkan
semua aksi pengguna; store Zustand memisahkan state formulir dari rute
valid terakhir; modul domain murni menghitung rute, pulang-pergi,
elevasi, penghindaran, GPX, dan gambar.

## Konfigurasi Runtime

`public/config.json` menentukan endpoint penyedia layanan dan divalidasi
dengan Zod sebelum dipakai. Nilai default menunjuk ke homeserver Valhalla
RideTopo dan Nominatim publik.

## Build Cloudflare Pages

```bash
npm run build
```

Output build: `dist/`. Setel direktori output Cloudflare Pages ke
`dist/` dan perintah build ke `npm run build`.

## Penyedia Layanan dan Atribusi

- **Data rute**: OpenStreetMap contributors
- **Mesin rute**: Valhalla
- **Elevasi**: graph elevasi Valhalla (DEM Mapzen Terrain Tiles/SRTM)
- **Peta dasar**: OpenFreeMap (Liberty)
- **Font**: Plus Jakarta Sans (SIL Open Font License, self-hosted)
- **Kode**: AGPL-3.0

Route data © OpenStreetMap contributors — https://openstreetmap.org/copyright

## Batasan P0

Fitur berikut tidak termasuk dalam rilis P0:

- Google Maps, berbagi URL, kartu berbasis peta, radius privasi
- Mode gelap, generator loop target jarak, waypoint pulang manual
- Riwayat rute, akun, analitik, Workers, Pages Functions, D1, KV, R2

## Lisensi

AGPL-3.0. Lihat [LICENSE](./LICENSE).
