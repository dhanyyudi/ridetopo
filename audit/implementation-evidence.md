# Bukti Implementasi — RideTopo P0

**Branch:** fix/audit-remediation-2026-09
**HEAD:** `c9c0762`
**Audit terakhir:** 5 September 2026 (audit ulang menyeluruh + remediasi)
**Audit sebelumnya:** 13 dan 22 Agustus 2026

## Ringkasan

P0 diimplementasikan penuh dan diaudit tiga kali. Audit 5 September 2026
menemukan lima temuan blocker dan sepuluh temuan major yang **lolos dari
seluruh gate otomatis** karena setiap fixture dan mock hanya mewakili satu
bentuk respons. Semuanya sudah diperbaiki beserta tes regresinya; jumlah tes
naik dari 131 menjadi 190 unit/integrasi dan dari 29 menjadi 35 kasus E2E.

Kontrak live diverifikasi ulang terhadap homeserver pada 5 September 2026 dan
mengonfirmasi salah satu temuan sebagai cacat nyata. Blocker yang tersisa
seluruhnya berada di sisi QA perangkat nyata dan pengukuran kinerja lapangan.

## Matriks Perintah (5 September 2026)

| Perintah | Exit | Hasil |
|---|---|---|
| `npm run check:public` | 0 | tidak ada jalur privat/kredensial |
| `npm run lint` | 0 | max-warnings=0 |
| `npm run typecheck` | 0 | strict TS |
| `npm run test` | 0 | 18 file, **190 tes** |
| `npm run build` | 0 | dist statis, tanpa source map |
| `npm run verify:build` | 0 | 41 pemeriksaan lolos |
| `npm run test:e2e` | 0 | **109 tes: 35 kasus × 3 browser + 4 kasus degradasi tanpa WebGL** |
| `npm audit --omit=dev --audit-level=high` | 0 | 0 kerentanan produksi |
| `npm audit --audit-level=critical` | 0 | lolos; satu *high* di dev tree (`fast-uri`) |
| `npm run verify` (rangkaian penuh) | 0 | seluruh gate berurutan lolos |
| `git log --all --name-only` | — | tidak ada `plan/`, `.superpowers/`, `.env`, kredensial |

## Matriks Browser E2E (5 September 2026)

| Kasus | Chromium | Firefox | WebKit |
|---|---|---|---|
| route-planning (8) | pass | pass | pass |
| round-trip (4) | pass | pass | pass |
| road-review (4) | pass | pass | pass |
| offline-export (2) | pass | pass | pass |
| accessibility (10, termasuk axe) | pass | pass | pass |
| screenshots (7) | pass | pass | pass |

Ditambah proyek `firefox-no-webgl` (4 kasus): browser tanpa WebGL sama sekali —
perangkat lama atau driver yang masuk blocklist. MapLibre tidak dapat mulai di
sana, dan aplikasi harus tetap dapat dipakai.

Axe dijalankan terhadap composer; tidak ada pelanggaran serious/critical.

## Audit 5 September 2026 — temuan dan perbaikan

### Blocker

| # | Temuan | Perbaikan |
|---|---|---|
| B1 | **Rute dengan titik antara terpotong.** Valhalla mengembalikan satu leg per pasangan lokasi berurutan; `planRoute` hanya memakai `legs[0]`, sehingga jarak, durasi, geometri, elevasi, GPX, dan kartu gambar hanya menggambarkan A → titik antara pertama. Terbukti runtime: respons 10 km + 8 km menghasilkan 10.000 m. | Leg digabung menjadi satu trip di dalam batas provider (`merge-legs.ts`): geometri disambung tanpa menggandakan simpul temu, jarak/durasi dijumlahkan, elevasi digeser ke satu sumbu, shape gabungan di-encode ulang. Fixture dan mock E2E multi-leg ditambahkan. |
| B2 | **Elevasi round trip salah di panel hasil.** Sampel leg pulang dimulai lagi dari 0 dan digabung tanpa offset, sehingga sumbu jarak tidak monoton, grafik melipat balik, dan angka naik/turun berbeda dari yang dipakai kartu gambar. | Satu analisis elevasi per rute (`route-elevation.ts`), memakai sumbu kumulatif gabungan yang sama dengan GPX. |
| B3 | **Ketuk rute di peta tidak berfungsi.** Handler tidak pernah dipasang, dan handler-nya membaca properti fitur yang tidak pernah ada pada sumber GeoJSON. | Ketukan diproyeksikan ke geometri rute (`distanceAlongRoute`). Di mode tinjau, ketukan memilih ruas atau batas koridor berikutnya, persis seperti daftar. |
| B4 | **Peta kosong saat mode Tinjau ruas jalan.** Geometri di-null-kan dan overlay seleksi tidak pernah dikirim. | Rute tetap tampil sebagai satu garis teal dengan ruas terpilih disorot oranye; peta hasil diwarnai per medan. |
| B5 | **Makna medan hanya lewat warna.** Tidak ada legenda; tiga kata medan terdefinisi tapi tidak pernah dipakai. | Legenda bernama dengan ikon dan swatch, plus grafik elevasi yang kini menjadi slider dengan kursor pointer dan keyboard yang dicerminkan di peta. |

### Major

| # | Temuan | Perbaikan |
|---|---|---|
| M1 | Atribusi peta dirender sebagai teks HTML mentah dan disembunyikan dari screen reader | Tautan React sungguhan, tanpa `aria-hidden` |
| M2 | Draft menyimpan metadata ruas milik rute sebelumnya (snapshot dibaca sebelum reset) | Draft dibangun dari store terkini; tes regresi ditambahkan |
| M3 | Panel desktop 655–720 px, bukan 400–440 px (aturan wide kalah spesifisitas) | Aturan di-scope ke `.app-layout`; dijaga tes E2E |
| M4 | Array elevasi hanya divalidasi bila terlalu panjang; array terlalu pendek diterima dan totalnya disajikan sebagai total rute | Validasi dua arah, dan sampel yang tidak dapat dipetakan dibuang tanpa membatalkan rute; `analyzeElevation` kini memakai panjang rute sebagai gerbang kelengkapan |
| M5 | Downsample 50 exclusion tidak ada di jalur produksi (`.slice`), modul teruji tidak terpakai | Penggabungan dan downsample merata lewat modul teruji |
| M6 | Dua algoritma O(n²): resampling overlap dan penulisan GPX | Keduanya berjalan dengan kursor tunggal; dijaga tes anti-regresi |
| M7 | Tinjau ruas dan avoidance hanya mencakup leg berangkat | Keduanya bekerja pada geometri gabungan; rentang km dari profil kumulatif |
| M8 | Parsing `alternates` hanya mengenali bentuk bersarang, sehingga nol alternate pernah terbaca | Bentuk pembungkus `trip` di level atas diterima; **dikonfirmasi terhadap server live 5 September 2026** (lihat verifikasi kontrak live); mock E2E memakai bentuk tersebut |
| M9 | Marker A/B tidak terlihat di screenshot bukti | **Bukan cacat produk** — artefak mock: geometri fixture tidak berhubungan dengan koordinat A/B, jadi marker berada di luar bounds rute. Tes E2E membuktikan marker ada dan terlihat |
| M10 | `/offline-probe.txt` tidak pernah ada; HEAD ke URL 404 setiap 30 detik | Probe memakai `/config.json` |
| M11 | **Overlay peta gagal menutupi seluruh dialog picker.** `.map-fallback` absolut dan dipasang sebagai sibling kanvas, sehingga konteks posisinya adalah dialog `position: fixed` — tombol Batal dan Simpan tidak dapat diklik. Hanya terjadi ketika WebGL tidak tersedia, jadi tidak pernah terlihat | Fallback dipindah ke dalam area kanvas; pesan diganti agar mengarahkan ke pencarian, bukan menyebut rute; ditutup suite degradasi `firefox-no-webgl` |

### Penyimpangan spesifikasi yang ditutup

- Preferensi profil/jalan/medan kini bertahan di `localStorage` (FR-DRAFT-01).
  Tidak ada data lokasi di sana; lokasi, exclusion, geometri, dan state round
  trip tetap di draft IndexedDB tervalidasi.
- Cache sesi untuk query identik dan gerbang satu permintaan/detik yang benar-benar
  berurutan (FR-GEO-02). Header `User-Agent` dihapus: browser menolak menyetelnya.
- Precheck jarak garis lurus 500 km sebelum request dikirim (FR-LOC-04).
- Pewarnaan medan pada polyline peta hasil (FR-ELEV-05).
- Cross-highlight chart ↔ peta lewat pointer dan keyboard (FR-ELEV-05).
- Rentang km ruas dihitung dari jarak kumulatif, bukan proporsi indeks (FR-ROAD-02).
- Batas koridor ditampilkan dalam kilometer, dan dapat dipilih dari daftar
  maupun peta (FR-AVOID-03).
- Fallback ruas tanpa metadata dirender persis seperti spesifikasi (FR-ROAD-02).
- Toggle round trip muncul setelah A dan B valid (FR-ROUNDTRIP-01).
- Focus trap pada map picker, dialog pencarian, dan pratinjau gambar (§24).
- Penolakan izin lokasi menjadi pesan inline di dekat kontrol lokasi, bukan
  error routing (FR-LOC-02).
- Seluruh string antarmuka berasal dari `src/content/id.ts`; tidak ada kunci
  yang tidak terpakai dan tidak ada duplikasi teks kelas jalan.

## Screenshot Publik

- `audit/screenshots/composer-390.png`
- `audit/screenshots/result-390.png`
- `audit/screenshots/road-review-390.png`
- `audit/screenshots/image-preview-390.png`
- `audit/screenshots/composer-1440.png`
- `audit/screenshots/result-1440.png`
- `audit/screenshots/road-review-1440.png`

Diambil dari build produksi pada 5 September 2026. Desktop menampilkan panel
persisten 400–440 px plus peta; mobile memakai hierarki peta + sheet.

## Pemeriksaan Live Provider (read-only, 13 dan 22 Agustus 2026)

| Pemeriksaan | Hasil |
|---|---|
| POST `/route` Road Bike | OK — rute Jakarta 5,36 km, status 0 |
| POST `/route` Commuter Bike | OK — 5,36 km, status 0 |
| Elevasi rute datar | OK — 180 sampel, min 0,2 / maks 18,2 m, tanpa `-500` |
| Elevasi rute menanjak (Bandung–Lembang) | OK — 550 sampel, 698,5–1254,6 m, tanpa `-500` |
| `/trace_attributes` edge_walk | OK — 140 edge; kelas `service_other` diamati dan dipetakan |
| OpenFreeMap style + CORS | OK — 200, `access-control-allow-origin: *` |
| Nominatim Indonesia submit-only | OK — hasil Monas terfilter `countrycodes=id` |
| CORS preflight `OPTIONS /route` | DIPERBAIKI 22 Agustus 2026 — Nginx Proxy Manager men-short-circuit `OPTIONS` untuk host `valhalla.dhanypedia.it.com` dengan 204 + header CORS (konfig di `/data/nginx/custom/server_proxy.conf`, guard `$host`). Preflight terverifikasi 204 via curl. |
| `linear_cost_factors` | DIPERBAIKI 22 Agustus 2026 — akar masalah adalah arah shape: edge-walk mengikuti edge terarah, sehingga shape terbalik gagal (error 233) pada koridor satu arah. Frontend mengirim shape searah rute; terverifikasi live (12,605 km → 12,296 km dengan faktor 5). |
| `alternates: 2` | Server mengembalikan 2 alternates pada request B→A dengan penalti (11,629 km utama + 12,537/13,020 km alternatif). Bentuk JSON-nya diverifikasi pada 5 September 2026 — lihat bagian berikutnya. |

Frontend mengirim `linear_cost_factors` sebagai `{shape: <encoded polyline6
searah rute>, factor: 5}`, dan `units: kilometers` di level atas maupun di
`directions_options` agar versi Valhalla lama maupun baru membacanya.

## Verifikasi Kontrak Live (read-only, 5 September 2026)

Dijalankan terhadap Valhalla 3.7.x di homeserver. Seluruh pemeriksaan hanya
membaca; tidak ada mutasi homeserver.

| Pemeriksaan | Hasil |
|---|---|
| Preflight `OPTIONS /route` | 204, header CORS lengkap |
| POST `/route` dengan `units` di level atas | Diterima; `trip.units` = `kilometers` |
| `elevation_interval: 30` pada rute pendek kota | 277 sampel untuk leg 8,265 km — rentang array cocok dengan panjang leg dalam toleransi |
| `linear_cost_factors` searah rute, terminal-trim | Diterima (status 0, tanpa error 233); rute pulang berbeda dari rute berangkat |
| **Bentuk `alternates`** | **`alternates` berada di level atas respons, masing-masing dibungkus objek `trip`. `trip.alternates` tidak pernah ada.** Parser lama yang membaca `trip.alternates` karena itu selalu menghasilkan nol alternates |
| Parser terhadap respons live (kasus Jakarta–Bogor) | Trip utama 57,912 km / 2.297 vertex; **2 alternates terbaca** (55,271 dan 56,976 km) |
| Elevasi terhadap respons live yang sama | 1.932 sampel, nol sentinel, `complete = true`, estimasi naik 592 m / turun 295 m, 583 seksi medan |
| Encode ulang shape gabungan | Byte-identical dengan shape asli dari server — tidak ada drift pembulatan |
| `/trace_attributes` edge_walk atas shape yang di-encode ulang | 1.260 edge; `end_shape_index` maksimum 2296 tepat cocok dengan 2.297 vertex, jadi indeks ruas memetakan persis ke geometri rute |

Kelas jalan yang teramati pada korpus ini: `trunk`, `primary`, `secondary`,
`tertiary`, `unclassified`, `residential`, `service_other` — seluruhnya
terpetakan oleh adapter.

Konsekuensi: temuan M8 terbukti sebagai cacat nyata, bukan sekadar dugaan.
Mode *Lewat jalan lain* sebelumnya selalu jatuh ke jalur "alternatif terbatas"
karena tidak satu pun alternate pernah terbaca.

## Pengukuran Kinerja

Tidak ada perangkat Android/iOS nyata yang tersedia untuk pengukuran
LCP/INP/CLS. Pengukuran dilakukan hanya lewat build statis: bundle JS
terpotong lewat dynamic import untuk MapLibre dan modul ekspor. Dua jalur
O(n²) (scoring overlap dan serialisasi GPX) dihapus pada 5 September dan
dijaga oleh tes anti-regresi. Target LCP ≤ 2,5 s / INP ≤ 200 ms / CLS ≤ 0,1
pada perangkat nyata **belum dibuktikan** dan tetap menjadi gate sebelum
production.

## Keterbatasan yang Diketahui

1. **Perangkat nyata**: QA Android Chrome/PWA dan iOS Safari/Add to Home
   Screen belum dijalankan; tidak ditandai sebagai lolos.
2. **Kinerja lapangan**: metrik LCP/INP/CLS pada perangkat Android kelas
   menengah belum diukur.
3. **Penyimpangan minor yang diketahui**:
   - Dokumen plan/PRD masih menyebut shape cost-factor terbalik; implementasi
     searah rute adalah yang benar per kontrak live. `plan/` bersifat
     read-only, jadi koreksi dokumen menunggu keputusan pemilik produk.
   - `style-src 'unsafe-inline'` di CSP diterima (kebutuhan MapLibre/React);
     tanpa `unsafe-eval` dan tanpa wildcard.
   - Satu advisory *high* (`fast-uri`) berada di dependency pengembangan;
     gate produksi tetap nol kerentanan.
4. **Catatan infra**: perbaikan CORS berada di file override NPM
   (`/data/nginx/custom/server_proxy.conf`). Regenerasi total konfigurasi NPM
   di masa depan harus memastikan file ini masih ada.

## Deklarasi

- Tidak ada push, pembuatan PR, atau deployment.
- Satu mutasi homeserver dilakukan atas izin eksplisit pemilik pada 22 Agustus
  2026 (CORS preflight host Valhalla). Pemeriksaan 5 September 2026 seluruhnya
  read-only: hanya `OPTIONS /route`, `POST /route`, `POST /trace_attributes`,
  dan `GET /status` dengan koordinat publik, tanpa mutasi apa pun.
- Tidak ada commit terhadap jalur privat (`plan/`, `.superpowers/`, `.codex/`,
  `.agents/`), kredensial, atau file rencana.
- Semua commit lolos hook pre-commit tanpa `--no-verify`.
- Working tree bersih kecuali artefak lokal yang diabaikan.
