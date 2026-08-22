# Bukti Implementasi — RideTopo P0 Remediation

**Branch:** fix/p0-audit-remediation
**HEAD:** `a0456f3` (HEAD terverifikasi saat matriks final dijalankan ulang pada 22 Agustus 2026; lihat `git rev-parse HEAD`)
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
| `a0456f3` | fix: align round-trip penalty shape with live contract and close audit gaps |

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
| `npm run test` | 0 | 131 tes (unit + integrasi) |
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
| **CORS preflight `OPTIONS /route`** | **DIPERBAIKI 22 Agustus 2026** — Nginx Proxy Manager kini men-short-circuit `OPTIONS` untuk host `valhalla.dhanypedia.it.com` dengan 204 + header `Access-Control-Allow-Origin/Methods/Headers/Max-Age` (konfig di `/data/nginx/custom/server_proxy.conf`, guard `$host` agar 44 host lain tidak terpengaruh). Preflight terverifikasi 204 via curl. |
| **`linear_cost_factors`** | **DIPERBAIKI 22 Agustus 2026** — akar masalah bukan di parser melainkan arah shape: edge-walk Valhalla mengikuti edge terarah, sehingga shape yang dibalik gagal (error 233) pada koridor dengan one-way. Frontend kini mengirim shape searah rute (`plan-round-trip.ts`); terverifikasi live: faktor 5 mengubah rute (12,605 km → 12,296 km, shape berbeda). |
| **`alternates: 2`** | **OK 22 Agustus 2026** — server mengembalikan 2 alternates pada request B→A dengan penalti (11,629 km utama + 12,537/13,020 km alternatif). |

Frontend mengirim `linear_cost_factors` sebagai `{shape: <encoded polyline6 searah rute>, factor: 5}`. Dengan preflight CORS, faktor searah, dan alternates yang kini berfungsi, mode *Lewat jalan lain* berjalan penuh tanpa fallback.

## Pengukuran Kinerja

Tidak ada perangkat Android/iOS nyata yang tersedia untuk pengukuran
LCP/INP/CLS. Pengukuran dilakukan hanya lewat build statis: bundle JS
terpotong lewat dynamic import untuk MapLibre dan modul ekspor. Target
LCP ≤ 2,5 s / INP ≤ 200 ms / CLS ≤ 0,1 pada perangkat nyata **belum
dibuktikan** dan tetap menjadi gate sebelum production.

## Keterbatasan yang Diketahui

1. **Perangkat nyata**: QA Android Chrome/PWA dan iOS Safari/Add to
   Home Screen belum dijalankan; tidak ditandai sebagai lolos.
2. **Kinerja lapangan**: metrik LCP/INP/CLS pada perangkat
   Android kelas menengah belum diukur.
3. **Penyimpangan minor yang diketahui** (dari audit end-to-end
   22 Agustus 2026, tidak menahan rilis):
   - Pewarnaan medan pada polyline peta hasil (FR-ELEV-05) belum
     diimplementasikan; band medan tersedia di chart elevasi.
   - Cross-highlight chart↔map belum terhubung (ditoleransi PRD P1).
   - Cache sesi Nominatim untuk query identik belum ada (throttle
     1 detik tetap berlaku).
   - Preferensi tersimpan via draft IndexedDB, bukan localStorage.
   - Dokumen plan/PRD masih menyebut shape cost-factor terbalik;
     implementasi searah rute adalah yang benar per kontrak live.
4. **Catatan infra**: perbaikan CORS berada di file override NPM
   (`/data/nginx/custom/server_proxy.conf`). Jika host proxy Valhalla
   diedit lewat UI NPM, file ini tetap berlaku; namun regenerasi total
   konfigurasi NPM di masa depan harus memastikan file ini masih ada.

## Audit End-to-End (22 Agustus 2026)

Audit dilakukan langsung (pengganti audit Codex) mencakup cakupan
spesifikasi P0, keamanan/privasi/higienitas repo, arsitektur, dan
kebenaran kalkulasi. Temuan dan tindak lanjut:

| Temuan | Severity | Status |
|---|---|---|
| Cache metadata ruas tidak dibuang saat rute berubah dan ikut tersimpan ke draft (FR-ROAD-01) | MAJOR | **Diperbaiki** — `setLastValidRoute` kini mereset `roadSegments`/`roadMetadataError`; tes regresi ditambahkan |
| Ekspor GPX round-trip memetakan elevasi leg pulang ke jarak salah | MAJOR | **Diperbaiki** — `build-gpx.ts` memakai `mergeElevationSamples`; tes regresi dengan elevasi leg pulang non-kosong ditambahkan |
| Direktori `audit/` ter-track di git | dilaporkan MAJOR | **Bukan temuan** — `audit/` memang artefak bukti publik sesuai deliverable rencana (7 screenshot public-safe); daftar privat di AGENTS.md/hook/scanner tidak mencakupnya |
| Drift PRD/plan soal arah shape cost-factor | MINOR | Didokumentasikan; plan/ bersifat read-only |
| `style-src 'unsafe-inline'` di CSP | MINOR | Diterima (kebutuhan MapLibre/React); tanpa `unsafe-eval`/wildcard |
| 4 temuan minor lain (warna medan peta, cross-highlight, cache Nominatim, media penyimpanan preferensi) | MINOR | Didokumentasikan di Keterbatasan |

Selain itu diverifikasi: nol pola tidak aman di `src/` (tanpa
`innerHTML`/`eval`/token), git history bersih dari jalur privat dan
kredensial, lisensi AGPL-3.0 + OFL font lengkap, dan tidak ada
kebocoran fitur P1/P2.

## Deklarasi

- Tidak ada push, pembuatan PR, atau deployment.
- Satu mutasi homeserver dilakukan atas izin eksplisit pemilik:
  penambahan `/data/nginx/custom/server_proxy.conf` di container NPM
  untuk CORS preflight host Valhalla (22 Agustus 2026). Tidak ada
  mutasi lain pada homeserver.
- Tidak ada commit terhadap jalur privat (`plan/`, `.superpowers/`,
  `.codex/`, `.agents/`), kredensial, atau file rencana.
- Semua commit lolos hook pre-commit tanpa `--no-verify`.
- Working tree bersih kecuali artefak lokal/build yang diabaikan.
