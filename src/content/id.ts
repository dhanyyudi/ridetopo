export const COPY = {
  appName: "RideTopo",
  appTagline: "Rencanakan rute sepeda Anda",

  /* Navigation */
  navComposer: "Rencanakan rute",
  navResult: "Hasil rute",
  navRoadReview: "Tinjau ruas jalan",
  navPrivacy: "Privasi",
  navAbout: "Tentang",

  /* Composer */
  startPoint: "Titik mulai",
  destination: "Tujuan",
  addWaypoint: "Tambah titik antara",
  waypointLabel: "Titik antara",
  maxWaypointReached: "Maksimal 20 titik antara.",
  searchPlaceholder: "Cari lokasi...",
  searchButton: "Cari",
  pickOnMap: "Pilih di peta",
  myLocation: "Lokasi saya",
  locationDenied: "Izin lokasi tidak diberikan. Gunakan pencarian atau pilih di peta.",
  removeWaypoint: "Hapus titik",
  swapDirections: "Tukar arah",
  planRoute: "Rencanakan rute",
  noRouteFound: "Tidak ditemukan rute lain yang dapat digunakan.",

  /* Profiles */
  profileLabel: "Jenis sepeda",
  roadBike: "Road Bike",
  commuterBike: "Commuter Bike",
  roadPreference: "Preferensi jalan",
  standardRoad: "Standard",
  smallRoads: "Jalan Kecil",
  terrainPreference: "Preferensi tanjakan",
  standardTerrain: "Standard",
  flatter: "Lebih Landai",

  /* Round trip */
  returnToStart: "Kembali ke titik awal",
  returnMode: "Rute pulang",
  returnDifferentRoad: "Lewat jalan lain",
  returnFastest: "Pulang tercepat",
  returnHelper: "Rute pulang akan diupayakan melalui jalan yang berbeda.",
  returnFastestHelper: "Rute pulang tercepat tanpa prioritas jalan berbeda.",
  startAndEnd: "Titik mulai dan selesai",
  limitedReturn: "Rute pulang melewati beberapa jalan yang sama dengan rute berangkat.",

  /* Route result */
  routeDistance: "Jarak",
  routeDuration: "Estimasi waktu bersepeda",
  durationDisclaimer: "Belum termasuk waktu berhenti.",
  elevationGain: "Elevasi naik",
  elevationLoss: "Elevasi turun",
  elevationUnavailable: "Data elevasi belum tersedia untuk rute ini.",
  roadReview: "Tinjau ruas jalan",
  exportGpx: "Ekspor GPX",
  shareImage: "Bagikan gambar",
  downloadImage: "Unduh PNG",

  /* Road review */
  roadReviewTitle: "Tinjau ruas jalan",
  unnamedRoad: "Ruas tanpa nama",
  roadClassLocal: "Jalan Lokal",
  surfaceUnknown: "Permukaan tidak diketahui",
  avoidRoad: "Hindari ruas ini",
  extendArea: "Perpanjang area",
  extendStart: "Batas awal",
  extendEnd: "Batas akhir",
  applyAvoidance: "Terapkan",
  cancelAvoidance: "Batal",
  avoidanceFailed: "Ruas belum berhasil dihindari. Coba perpanjang area yang dipilih.",
  activeExclusions: "Jalan yang dihindari",
  removeExclusion: "Hapus hindaran",
  maxExclusionsReached: "Maksimal 50 lokasi hindaran.",
  metadataUnavailable: "Data jalan belum tersedia. Rute tetap dapat dilihat.",
  exitReview: "Selesai tinjau",

  /* Export */
  exportTitle: "Ekspor rute",
  gpxDownload: "Unduh GPX",
  imagePreview: "Pratinjau gambar",
  shareSheet: "Bagikan",
  imagePrivacyWarning: "Gambar rute dapat memperlihatkan lokasi awal dan tujuan.",
  imageAttribution: "Route data © OpenStreetMap contributors — openstreetmap.org/copyright",
  planTitle: "Rencana rute",

  /* Draft */
  continueDraft: "Lanjutkan rute terakhir",
  deleteDraft: "Hapus rute",
  deleteDraftConfirm: "Hapus rute yang tersimpan? Tindakan ini tidak dapat dibatalkan.",

  /* Offline */
  offlineBanner: "Anda sedang offline. Rute tersimpan tetap dapat diakses.",
  offlineSearchDisabled: "Pencarian tidak tersedia saat offline.",
  offlineRouteDisabled: "Perencanaan rute tidak tersedia saat offline.",
  offlineTraceDisabled: "Data jalan tidak tersedia saat offline.",
  offlineExportAvailable: "Ekspor GPX dan gambar tetap tersedia.",

  /* Errors */
  errorGeneric: "Terjadi kesalahan. Silakan coba lagi.",
  errorConfig: "Gagal memuat konfigurasi.",
  errorRouteTooLong: "Maksimal total rute 500 km.",
  errorRouteFailed: "Gagal merencanakan rute. Silakan coba lagi.",
  errorNoRoute: "Tidak ditemukan rute yang dapat digunakan.",
  errorBasemap: "Peta tidak dapat ditampilkan. Rute tetap tersedia.",
  errorExport: "Gagal mengekspor. Silakan coba lagi.",
  errorImageRender: "Gagal membuat gambar. Silakan coba lagi.",
  loading: "Memuat...",
  calculating: "Menghitung rute...",

  /* Privacy */
  privacyTitle: "Privasi",
  privacyText: `RideTopo mengirimkan kueri lokasi dan koordinat rute ke penyedia layanan berikut:
- OpenStreetMap Nominatim (pencarian lokasi)
- Valhalla (perhitungan rute dan elevasi)
- OpenFreeMap (tile peta)

Satu draf rute terakhir disimpan di perangkat Anda dan dapat dihapus kapan saja. Gambar dan file GPX yang dibagikan dapat mengungkapkan titik awal dan akhir rute.

RideTopo tidak memiliki sistem akun, analitik, iklan, session replay, pelacakan, atau cookie non-esensial.`,

  /* About */
  aboutTitle: "Tentang",
  aboutText: `RideTopo adalah perencana rute sepeda untuk Indonesia.

Data rute: OpenStreetMap contributors
Mesin rute: Valhalla
Peta dasar: OpenFreeMap
Font: Plus Jakarta Sans (SIL Open Font License)

Lisensi: AGPL-3.0`,

  /* Limits */
  maxWaypoints: "Maksimal 20 titik antara.",
  maxDistance: "Maksimal total rute 500 km.",
  maxExclusions: "Maksimal 50 lokasi hindaran.",

  /* Format */
  km: "km",
  m: "m",
  hours: "jam",
  minutes: "mnt",
} as const;

export function formatDistance(meters: number): string {
  const km = meters / 1000;
  return `${new Intl.NumberFormat("id-ID", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(km)} km`;
}

export function formatElevation(meters: number): string {
  const rounded = Math.round(meters / 5) * 5;
  return `${new Intl.NumberFormat("id-ID").format(rounded)} m`;
}

export function formatDuration(seconds: number): string {
  const totalMinutes = Math.round(seconds / 60);
  if (totalMinutes < 60) {
    return `${totalMinutes} mnt`;
  }
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (minutes === 0) {
    return `${hours} jam`;
  }
  return `${hours} jam ${minutes} mnt`;
}

export function formatPercentage(ratio: number): string {
  return `${Math.round(ratio * 100)}%`;
}
