# Kebijakan Keamanan

## Melaporkan Kerentanan

Untuk melaporkan kerentanan keamanan, buka issue pada repositori
GitHub dan beri label "security". Jangan menyertakan detail
proof-of-concept sensitif di issue publik — kami akan menyediakan
kanal tindak lanjut yang aman.

## Versi yang Didukung

Hanya commit terbaru pada branch main yang didukung untuk pembaruan
keamanan.

## Kode Publik

RideTopo adalah aplikasi klien statis. Tidak ada rahasia, kunci, atau
kredensial yang disimpan di repositori. Konfigurasi disediakan melalui
`/config.json` saat runtime.

## Kontrol Keamanan Build

- `npm run check:public` memindai pohon publik untuk jalur privat dan
  pola kredensial berkeyakinan tinggi.
- `npm run verify:build` memeriksa artefak build, dimensi ikon, CSP,
  dan menolak artefak Worker/Function serta source map produksi.
- `npm run audit:security` menjalankan gate audit dependency
  (`--audit-level=high` untuk production dan `critical` keseluruhan).
- Hook pre-commit di `.githooks/pre-commit` memblokir file privat dan
  kredensial sebelum commit.

## Kebijakan CSP

Header `Content-Security-Policy` produksi:

```
default-src 'self'; base-uri 'self'; object-src 'none';
frame-ancestors 'none'; script-src 'self';
style-src 'self' 'unsafe-inline'; font-src 'self';
img-src 'self' data: blob: https://tiles.openfreemap.org;
connect-src 'self' https://valhalla.dhanypedia.it.com
https://nominatim.openstreetmap.org https://tiles.openfreemap.org;
worker-src 'self' blob:; manifest-src 'self';
form-action 'self'; upgrade-insecure-requests
```

Tidak ada origin wildcard maupun `unsafe-eval`.
