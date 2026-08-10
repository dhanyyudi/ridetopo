# AGENTS.md — RideTopo Agent Instructions

Setiap agen yang bekerja di repositori ini harus membaca dan mematuhi
instruksi berikut:

## Aturan Utama

1. **Rencana privat bersifat read-only.** Direktori `plan/`, `.superpowers/`,
   `.codex/`, dan `.agents/` tidak boleh di-stage, di-commit, atau
   dipublikasikan. Baca untuk referensi, jangan salin ke jalur publik.

2. **Jangan pernah bypass hooks.** Pre-commit hook di `.githooks/pre-commit`
   memblokir file rahasia, kredensial, dan jalur privat. Gunakan
   `git commit` normal tanpa `--no-verify`.

3. **Jangan push sebelum audit.** Semua pekerjaan dilakukan di branch lokal.
   Hanya Codex yang menyetujui branch siap untuk push dan deployment.

4. **Gunakan npm.** Semua perintah menggunakan `npm run`, bukan `yarn`,
   `pnpm`, atau `bun`.

5. **Stage eksplisit.** Jangan gunakan `git add -A` atau `git add .`.
   Stage file publik secara eksplisit dan periksa dengan `git diff --cached`
   sebelum commit.

6. **Jangan commit kredensial.** Tidak ada `.env`, `.dev.vars`, token,
   password, atau kunci privat yang boleh masuk ke repositori. Gunakan
   `.env.example` hanya untuk contoh nilai non-rahasia.

## Workflow

1. Buat branch dari main
2. Implementasi dengan TDD
3. Commit per package setelah tes lolos
4. Jangan push
5. Laporkan ke Codex untuk audit

## Perintah

Semua perintah pengembangan menggunakan npm:

```bash
npm run dev       # Server pengembangan
npm run build     # Build produksi
npm run lint      # ESLint
npm run typecheck # TypeScript
npm run test      # Unit/integrasi
npm run test:e2e  # Playwright E2E
npm run check:public # Pemeriksaan keamanan
npm run verify    # Lengkap
```

## Bahasa

- Antarmuka: Bahasa Indonesia
- Kode: Bahasa Inggris (nama variabel, fungsi, komentar)
- Dokumentasi: Bahasa Indonesia
