# Bukti Implementasi — RideTopo P0 Remediation

**Branch:** fix/p0-audit-remediation
**HEAD:** `c583c8d` (HEAD terverifikasi saat matriks final dijalankan ulang pada 21 Agustus 2026; lihat `git rev-parse HEAD`)
**Tanggal audit:** 13 Agustus 2026

## Ringkasan

Rencana remediasi empat paket kerja dieksekusi penuh di atas baseline
audit `ce2d53d`. Seluruh perjalanan pengguna P0 kini terhubung dan
terbukti melalui uji otomatis di tiga browser. Blocker eksternal yang
tersisa seluruhnya berada di sisi homeserver Valhalla.

## Commit Remediasi

| Commit | Pesan |
|---|---|
| `fdd73c2` | fix: connect complete route planning journey |
| `3301655` | fix: correct routing elevation and road avoidance |
| `0efc10c` | fix: complete secure offline and export experience |
| *(final)* | test: prove complete P0 release candidate |

## Matriks Perintah

| Perintah | Exit | Hasil |
|---|---|---|
| `rg 'TODO\|FIXME\|no-op' src tests` | 0 | tidak ada hit produksi |
| `git diff --check` | 0 | bersih |
| `npm ci` | 0 | lockfile valid |
| `npm run build:icons` | 0 | 6 raster icon dari master SVG |
| `npm run check:public` | 0 | tidak ada jalur privat/kredensial |
| `npm run lint` | 0 | max-warnings=0 |
| `npm run typecheck` | 0 | strict TS |
| `npm run test` | 0 | 129 tes (unit + integrasi) |
| `npm run build` | 0 | dist statis, tanpa source map |
| `npm run verify:build` | 0 | 41 pemeriksaan lolos |
| `npm run test:e2e` | 0 | 87 tes: 29 kasus × 3 browser |
| `npm run audit:security` | 0 | 0 kerentanan (high/critical) |

## Matriks Browser E2E

| Kasus | Chromium | Firefox | WebKit |
|---|---|---|---|
| route-planning (4) | pass | pass | pass |
| round-trip (4) | pass | pass | pass |
| road-review (4) | pass | pass | pass |
| offline-export (2) | pass | pass | pass |
| accessibility (8, termasuk axe) | pass | pass | pass |
| screenshots (7) | pass | — | — |

Axe dijalankan terhadap composer; tidak ada pelanggaran
serious/critical. Uji focus memastikan focus berpindah ke elemen
focusable dengan ring terlihat. Uji manifest memastikan setiap ikon
dapat diambil.

## Screenshot Publik

- `audit/screenshots/composer-390.png`
- `audit/screenshots/result-390.png`
- `audit/screenshots/road-review-390.png`
- `audit/screenshots/image-preview-390.png`
- `audit/screenshots/composer-1440.png`
- `audit/screenshots/result-1440.png`
- `audit/screenshots/road-review-1440.png`

Diambil dari build produksi. Desktop menampilkan panel persisten
400–440 px plus peta; mobile memakai hierarki peta + sheet.

## Pemeriksaan Live Provider (read-only, 13 Agustus 2026)

| Pemeriksaan | Hasil |
|---|---|
| POST `/route` Road Bike | OK — rute Jakarta 5,36 km, status 0 |
| POST `/route` Commuter Bike | OK — 5,36 km, status 0 |
| Elevasi rute datar | OK — 180 sampel, min 0,2 / maks 18,2 m, tanpa `-500` |
| Elevasi rute menanjak (Bandung–Lembang) | OK — 550 sampel, 698,5–1254,6 m, tanpa `-500` |
| `/trace_attributes` edge_walk | OK — 140 edge; kelas `service_other` diamati dan dipetakan |
| OpenFreeMap style + CORS | OK — 200, `access-control-allow-origin: *` |
| Nominatim Indonesia submit-only | OK — hasil Monas terfilter `countrycodes=id` |
| **CORS preflight `OPTIONS /route`** | **BLOCKED EXTERNAL CONTRACT** — 405 `Method Not Allowed` (error 101). Browser POST dengan Content-Type JSON akan gagal preflight. |
| **`linear_cost_factors` (shape terbalik)** | **BLOCKED EXTERNAL CONTRACT** — server menolak dengan "Failed to edge walk line feature" meskipun shape adalah kebalikan persis shape server (round-trip encode/decode diverifikasi identik). Bentuk `{shape: string, factor}` diterima parser; bentuk LineString ditolak dengan `IsString()`. |
| **`alternates: 2`** | **BLOCKED EXTERNAL CONTRACT** — request diterima (status 0) tetapi server tidak mengembalikan alternates. |

Frontend mengirim `linear_cost_factors` sebagai `{shape: <encoded polyline6>, factor: 5}` sesuai bentuk yang diterima parser server. Karena edge-walk menolak shape terbalik dan alternates tidak disediakan, mode *Lewat jalan lain* akan menggunakan fallback tanpa penalti dengan flag limited yang jujur — bukan hard exclusion tersembunyi.

## Pengukuran Kinerja

Tidak ada perangkat Android/iOS nyata yang tersedia untuk pengukuran
LCP/INP/CLS. Pengukuran dilakukan hanya lewat build statis: bundle JS
terpotong lewat dynamic import untuk MapLibre dan modul ekspor. Target
LCP ≤ 2,5 s / INP ≤ 200 ms / CLS ≤ 0,1 pada perangkat nyata **belum
dibuktikan** dan tetap menjadi gate sebelum production.

## Keterbatasan yang Diketahui

1. **CORS homeserver**: `OPTIONS /route` mengembalikan 405 sehingga
   browser POST gagal preflight. Perlu perbaikan reverse proxy
   (INFRA-01 pada dokumen prasyarat).
2. **Kontrak round trip**: server menolak `linear_cost_factors` dengan
   shape terbalik (edge walk) dan tidak mengembalikan alternates.
   Mode *Lewat jalan lain* belum dapat dinyatakan siap P0 secara
   produksi.
3. **Perangkat nyata**: QA Android Chrome/PWA dan iOS Safari/Add to
   Home Screen belum dijalankan; tidak ditandai sebagai lolos.
4. **Kinerja lapangan**: metrik LCP/INP/CLS pada perangkat
   Android kelas menengah belum diukur.

## Deklarasi

- Tidak ada push, pembuatan PR, deployment, atau mutasi homeserver.
- Tidak ada commit terhadap jalur privat, kredensial, atau file rencana.
- Semua commit lolos hook pre-commit tanpa `--no-verify`.
- Working tree bersih kecuali artefak lokal/build yang diabaikan.
