# RideTopo

Rencanakan rute sepeda Anda di Indonesia.

RideTopo adalah perencana rute sepeda berbasis web (PWA) yang mendukung
rute titik-ke-titik dan pulang-pergi, analisis elevasi, tinjauan ruas
jalan, ekspor GPX, dan berbagi gambar rute.


## Fitur P0

- **Perencanaan rute** titik-ke-titik dengan hingga 20 titik antara
- **Rute pulang-pergi** dengan prioritas jalan berbeda
- **Analisis elevasi** (tanjakan, turunan, tanjakan) dan klasifikasi medan
- **Tinjauan ruas jalan** dengan nama, kelas, dan permukaan jalan
- **Hindari ruas jalan** yang tidak diinginkan
- **Ekspor GPX** dengan geometri lengkap
- **Gambar Story** (1080×1920 PNG) untuk berbagi rute
- **Draf lokal** untuk melanjutkan rute terakhir
- **Dukungan offline** untuk melihat dan mengekspor rute tersimpan


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
| `npm run lint` | ESLint (max-warnings=0) |
| `npm run typecheck` | TypeScript type check |
| `npm run test` | Unit dan integrasi test |
| `npm run test:e2e` | Playwright end-to-end |
| `npm run check:public` | Pemeriksaan keamanan repositori |
| `npm run verify` | Semua pemeriksaan |

## Arsitektur

RideTopo adalah aplikasi **statis** React/TypeScript SPA yang dihosting
di Cloudflare Pages. Tidak ada backend server — semua komputasi
dilakukan di browser.

```
Browser → /config.json → Nominatim, Valhalla, OpenFreeMap
```

## Konfigurasi Runtime

`public/config.json` menentukan endpoint penyedia layanan. Lihat file
tersebut untuk konfigurasi default yang dapat disesuaikan saat deployment.

## Build Cloudflare Pages

```bash
npm run build
```

Output build: `dist/`

Setel direktori output Cloudflare Pages ke `dist/` dan perintah build
ke `npm run build`.

## Penyedia Layanan

- **Data rute**: OpenStreetMap contributors
- **Mesin rute**: Valhalla
- **Peta dasar**: OpenFreeMap
- **Font**: Plus Jakarta Sans (SIL Open Font License)

## Batasan P0

Fitur berikut tidak termasuk dalam rilis P0:
- Google Maps, berbagi URL, kartu berbasis peta
- Radius privasi, mode gelap
- Akun, analitik, histori rute
- Workers, Pages Functions, D1, KV, R2

## Lisensi

AGPL-3.0. Lihat [LICENSE](./LICENSE).

---

Route data © OpenStreetMap contributors — https://openstreetmap.org/copyright
