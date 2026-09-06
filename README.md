# RideTopo

**Rencanakan rute sepeda Anda di Indonesia.**

RideTopo membantu Anda memahami sebuah rute sebelum mengayuh: seberapa
jauh, seberapa menanjak, lewat jalan apa, dan kira-kira sampai jam
berapa. Dibuka lewat browser, tanpa akun, tanpa unduhan.

🔗 **[ridetopo.pages.dev](https://ridetopo.pages.dev)**

> **Status: pratinjau publik, belum siap produksi.**
> Semua alur utama sudah berjalan. Yang belum: pengujian pada perangkat
> Android dan iOS sungguhan, serta pengukuran kecepatan aplikasi di
> jaringan nyata. Keduanya syarat sebelum dinyatakan siap produksi.

---

## Untuk siapa

Pesepeda yang merencanakan perjalanannya sendiri — berangkat ke kantor
lewat jalan yang lebih tenang, mencari rute akhir pekan yang tidak
terlalu menanjak, atau menyusun rute pulang-pergi tanpa melewati jalan
yang sama dua kali.

RideTopo bukan aplikasi navigasi. Tidak ada suara belok kiri–belok kanan
saat Anda sedang di jalan. Ini alat untuk sebelum berangkat.

## Apa yang bisa dilakukan

**Menyusun rute.** Tentukan titik mulai dan tujuan lewat pencarian nama
tempat, dengan menunjuk langsung di peta, atau memakai lokasi perangkat
Anda. Bisa ditambahkan sampai 20 titik singgah dan diurutkan ulang.
Panjang satu rute maksimal 500 km.

**Melihat jam berangkat dan jam tiba.** Isi rencana jam berangkat — bukan
selalu "sekarang", karena perencanaan sering dilakukan malam sebelumnya.
Titik awal dan titik akhir di peta memperlihatkan perkiraan waktunya.

**Pulang-pergi.** Aktifkan *Kembali ke titik awal* dan RideTopo mencari
jalan pulang yang berbeda bila memang tersedia. Kalau tidak tersedia,
aplikasi mengatakannya apa adanya — tidak ada janji "loop tanpa jalan
yang sama".

**Membaca medan.** Profil elevasi lengkap dengan perkiraan total naik dan
turun. Rutenya diwarnai menurut medan — menanjak, landai, menurun — dan
setiap warna selalu punya namanya di legenda. Grafiknya bisa ditelusuri
dengan pointer maupun tombol panah, dan posisinya ikut tampil di peta.

**Meninjau ruas jalan.** Buka *Tinjau ruas jalan* untuk melihat nama,
jenis, dan permukaan tiap ruas yang akan dilewati, lalu menghindari satu
ruas atau satu koridor. Bisa dipilih dari daftar atau dengan mengetuk
rutenya langsung di peta. Kalau rute penggantinya ternyata masih
melintasi ruas itu, hasilnya ditolak dan rute lama dipertahankan.

**Membawa hasilnya keluar.** Unduh berkas GPX untuk dibuka di komputer
sepeda atau aplikasi lain, atau buat kartu gambar ukuran Story untuk
dibagikan.

**Tetap terbuka saat offline.** Satu rancangan rute terakhir tersimpan di
perangkat Anda. Saat sinyal hilang, ringkasan, grafik elevasi, GPX, dan
kartu gambar tetap bisa dibuka. Pencarian, perhitungan rute, dan bagian
peta yang belum termuat dinyatakan tidak tersedia dengan jelas — bukan
dibiarkan berputar tanpa kabar.

## Yang kami janjikan, dan yang tidak

- **Rute pertama adalah hasil mesin apa adanya.** Tidak ada klaim "paling
  aman". RideTopo tidak menilai keselamatan sebuah jalan.
- **Preferensi bukan jaminan.** *Jalan Kecil* dan *Lebih Landai*
  menggeser kecenderungan mesin rute, bukan memerintahnya — dan teksnya
  memang mengatakan begitu.
- **Gagal menghitung tidak menghapus rute Anda.** Perhitungan ulang yang
  gagal mempertahankan hasil terakhir yang valid beserta ekspornya.
- **Tanpa presisi palsu.** Angka elevasi dibulatkan dan selalu berlabel
  perkiraan. Kalau datanya tidak menutup seluruh rute, totalnya
  disembunyikan alih-alih ditebak.
- **Waktu tempuh adalah perkiraan,** dihitung dari jarak dan jenis jalan
  — bukan dari catatan perjalanan Anda, dan belum termasuk waktu
  berhenti.

## Belum ada saat ini

Navigasi belok-per-belok, informasi lalu lintas, cuaca, akun pengguna,
sinkronisasi antar-perangkat, peta yang bisa diunduh untuk dipakai
offline, serta mode gravel atau MTB. Berbagi rute lewat tautan, membuka
rute di Google Maps, dan mode gelap direncanakan setelah rilis pertama
stabil.

## Bisa dipakai siapa saja

Tombolnya dibuat cukup besar untuk jempol, tampilannya tetap terpakai
mulai lebar layar 320 piksel, dan urutan fokus keyboard dijaga agar tidak
tersesat di dalam dialog. Setiap warna medan selalu disertai namanya,
jadi tidak ada informasi yang hanya bisa ditangkap lewat warna. Setiap
fungsi yang ada di peta juga punya jalan lain lewat daftar atau tombol,
sehingga peta tidak pernah menjadi satu-satunya cara.

## Privasi

Tidak ada akun, tidak ada iklan, tidak ada pelacakan, tidak ada perekaman
sesi, dan tidak ada cookie yang tidak perlu.

Yang keluar dari perangkat Anda hanya hal yang memang dibutuhkan untuk
menjawab: kata kunci yang Anda ketik dikirim ke layanan pencarian tempat,
titik-titik rute dikirim ke mesin perutean, dan peta dasar diminta ke
penyedianya. Satu rancangan rute disimpan di perangkat Anda sendiri dan
bisa Anda hapus kapan saja. Kartu gambar dibuat di perangkat Anda dan
tidak pernah diunggah ke mana pun.

Rinciannya ada di halaman Privasi di dalam aplikasi.

## Sumber data

- **Data jalan:** © OpenStreetMap contributors —
  [openstreetmap.org/copyright](https://openstreetmap.org/copyright)
- **Perhitungan rute:** [Valhalla](https://github.com/valhalla/valhalla)
- **Data elevasi:** Mapzen Terrain Tiles / SRTM
- **Peta dasar:** [OpenFreeMap](https://openfreemap.org)
- **Huruf:** Plus Jakarta Sans, SIL Open Font License

## Melaporkan masalah keamanan

Gunakan [private vulnerability reporting](https://github.com/dhanyyudi/ridetopo/security/advisories/new)
GitHub, bukan issue publik. Rinciannya di [SECURITY.md](./SECURITY.md).

## Untuk pengembang

Cara menjalankan, menguji, dan menyebarkan aplikasi ini ada di
[DEVELOPMENT.md](./DEVELOPMENT.md).

## Lisensi

[AGPL-3.0](./LICENSE). Lisensi data dan komponen pihak ketiga mengikuti
sumbernya masing-masing.
