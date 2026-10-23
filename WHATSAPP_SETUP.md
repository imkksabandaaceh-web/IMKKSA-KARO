# Panduan Fitur WhatsApp Pendataan Anggota

Panduan ini untuk pengurus IMKKSA yang **belum terbiasa** dengan teknis.
Ikuti berurutan dari atas ke bawah. Fitur ini memungkinkan calon anggota
mendaftar sendiri lewat chat WhatsApp ke nomor Fonnte, lalu datanya masuk
ke tabel `umat` dengan status **menunggu verifikasi admin** (sama seperti
pendaftaran lewat website).

Yang perlu disiapkan: akun Supabase (sudah ada), akun Fonnte dengan device
sudah terhubung (sudah ada), dan akses ke dashboard Vercel.

---

## Apa yang bisa dilakukan anggota lewat WhatsApp

| Ketikan | Arti |
|---------|------|
| `DAFTAR` | Mulai mendaftar sebagai anggota |
| `ULANG` | Tampilkan lagi pertanyaan yang sedang ditanyakan |
| `BATAL` | Batalkan proses pendaftaran |
| `BANTUAN` | Tampilkan daftar perintah |
| `LEWATI` | Lewati pertanyaan yang tidak wajib (alamat, tempat/tanggal lahir) |
| `YA` / `TIDAK` | Menyetujui atau membatalkan setelah ringkasan data |

Alur pendaftaran: nama → alamat → tempat lahir → tanggal lahir → ringkasan →
`YA`. Nomor WhatsApp pengirim otomatis dipakai sebagai nomor HP anggota.
Nomor yang sudah terdaftar akan ditolak otomatis (tidak bisa daftar dua kali).

Data yang masuk: `nama`, `status` (default "Anggota"), `alamat`, `no_hp`,
`tempat_lahir`, `tanggal_lahir`, dengan `is_pending = true` sehingga
**muncul di antrean verifikasi admin** dan belum tampil di website publik.
Kolom `photo` dan `kk` sengaja kosong (foto/KK tetap diisi manual oleh admin).

---

## Langkah 1 — Jalankan SQL di Supabase

Fitur ini butuh satu tabel baru: `wa_sessions` (penyimpan "sedang di langkah
mana" setiap nomor). Tabel `umat` **tidak diubah** sama sekali.

1. Buka [supabase.com](https://supabase.com) → login → pilih project IMKKSA.
2. Klik menu **SQL Editor** (ikon di bilah kiri).
3. Klik **New query**.
4. Buka file `supabase/migrasi_wa_sessions.sql` di project ini, **salin seluruh
   isinya**, tempel ke kotak SQL Editor.
5. Klik tombol **Run** (atau tekan Ctrl+Enter).
6. Harus muncul tulisan **"Success. No rows returned"**. Itu tanda berhasil.

Isi perintahnya hanya `create table if not exists ...`, `create index if not
exists ...`, dan `grant ... to service_role` (izin akses untuk server), jadi aman
dijalankan dua kali dan tidak menghapus data apa pun.

> **Sudah pernah membuat tabel ini sebelumnya?** Jalankan ulang file SQL yang
> terbaru. Perintah `grant` perlu ikut terpasang agar webhook bisa membaca/
> menulis `wa_sessions`; tanpa izin itu, log akan menampilkan
> `permission denied for table wa_sessions`.

---

## Langkah 2 — Isi Environment Variables di Vercel

Nilai rahasia **hanya** disimpan di dashboard Vercel dan di file `.env` lokal.
Jangan pernah menempelkan token ke chat, WhatsApp, atau file yang di-commit.

1. Buka [vercel.com](https://vercel.com) → pilih project website IMKKSA.
2. Klik **Settings** (menu atas) → **Environment Variables** (bilah kiri).
3. Tambahkan empat variabel berikut satu per satu (klik **Add New** /
   **Create New** untuk masing-masing):

| Nama variabel | Isinya apa | Diambil dari mana |
|---------------|------------|-------------------|
| `WA_GATEWAY_TOKEN` | Token Fonnte | Fonnte → pilih device → menu **Token** |
| `WA_WEBHOOK_SECRET` | Kata sandi rahasia buatan sendiri | Bebas, buat yang panjang & acak. Contoh cara membuat: ketik `openssl rand -hex 24` di terminal, atau karang sendiri 30+ karakter campur huruf & angka |
| `SUPABASE_URL` | Alamat project Supabase | Supabase → Settings → **API** → Project URL (bentuknya `https://xxxxx.supabase.co`) |
| `SUPABASE_SERVICE_ROLE_KEY` | Kunci rahasia Supabase | Supabase → Settings → **API Keys**. Boleh kunci model baru `sb_secret_...` (tab **Publishable and secret API keys**, klik **Reveal**) atau kunci lama `service_role` (JWT). Keduanya bisa dipakai. |

4. **Penting:** untuk setiap variabel, pada bagian **Environments** centang
   **Production** *dan* **Preview** (kalau ada pilihan Development, boleh
   dicentang juga). Kalau hanya Production yang dicentang, alamat pratinjau
   (preview) tidak akan berfungsi.
5. Klik **Save**.

> **Jangan** memberi awalan `VITE_` pada keempat variabel di atas. Variabel
> berawalan `VITE_` ikut terkirim ke browser pengunjung. `SUPABASE_SERVICE_ROLE_KEY`
> adalah kunci paling berbahaya di project ini: siapa pun yang memilikinya bisa
> membaca/menulis seluruh database. Simpan hanya di server.

Kalau Anda memakai Vercel CLI (`vercel` sudah terpasang dan sudah login), boleh
menambahkan lewat terminal. Nilai **Anda sendiri** yang mengetik:

```bash
vercel env add WA_GATEWAY_TOKEN production
vercel env add WA_GATEWAY_TOKEN preview
vercel env add WA_WEBHOOK_SECRET production
vercel env add WA_WEBHOOK_SECRET preview
vercel env add SUPABASE_URL production
vercel env add SUPABASE_URL preview
vercel env add SUPABASE_SERVICE_ROLE_KEY production
vercel env add SUPABASE_SERVICE_ROLE_KEY preview
```

Saat muncul pertanyaan "What's the value of ...?", tempel nilai aslinya lalu
tekan Enter. Jangan pernah menuliskan nilainya di dalam perintah.

---

## Langkah 3 — Redeploy

Environment variable baru hanya terbaca oleh deploy **baru**.

1. Buka project di Vercel → tab **Deployments**.
2. Pada deployment teratas, klik tombol **⋯** (titik tiga) di kanan → **Redeploy**
   → konfirmasi.
3. Tunggu sampai status **Ready**.

---

## Langkah 4 — Isi alamat webhook di Fonnte

1. Buka [fonnte.com](https://fonnte.com) → login → menu **Device**.
2. Pada device yang sudah terhubung, klik **Edit**.
3. Isi kolom **Webhook URL** dengan alamat lengkap berikut
   (`DOMAIN-SAYA` dan `ISI_SECRET_SAYA` diganti milik Anda):

   ```
   https://DOMAIN-SAYA/api/whatsapp?secret=ISI_SECRET_SAYA
   ```

   Contoh nyata:

   ```
   https://www.imkksa-bandaaceh.site/api/whatsapp?secret=7f3c9a1b8e2d4f6a0c5b9d7e3a1f8c2b
   ```

   Bagian `7f3c...` harus **persis sama** dengan nilai `WA_WEBHOOK_SECRET`
   yang Anda isi di Vercel. Kalau berbeda, semua pesan akan ditolak (401).

4. **Nyalakan "Auto Read" / "Baca otomatis"** pada device tersebut. Menurut
   dokumentasi Fonnte, kalau Auto Read mati, webhook tidak akan berjalan.
5. Klik **Save**.

---

## Langkah 5 — Uji coba dengan chat sungguhan

1. Pakai **HP lain** (bukan HP yang terpasang di Fonnte), kirim WhatsApp ke
   nomor device Fonnte.
2. Ketik: `DAFTAR` (boleh huruf kecil).
3. Ikuti pertanyaannya sampai muncul ringkasan, lalu balas `YA`.
4. Cek hasilnya di Supabase: **Table Editor** → tabel `umat` → baris terbaru
   dengan awalan id `pending_`. Nama pendaftar harus muncul dengan
   "pending" (menunggu verifikasi).
5. Buka panel admin website → tab data anggota → verifikasi/approve pendaftar
   seperti biasa.

---

## Langkah 6 — Cara mengecek log webhook di Vercel

Log adalah tempat pertama untuk melihat kenapa chat tidak dibalas. Log webhook
ini **tidak pernah memuat token atau kunci**, dan nomor HP disamarkan (contoh
`6281***333`).

### Membuka log di dashboard Vercel

1. Buka project di Vercel, lalu klik **Logs** di menu atas. Kalau tidak ada,
buka **Observability** → **Logs**.
2. Pilih environment sesuai alamat webhook yang dipakai di Fonnte:
   **Production** (domain utama) atau **Preview** (alamat pratinjau cabang).
3. Saring log: pilih **Function** = `api/whatsapp`, dan atur rentang waktu ke
   **Last 1 hour**.
4. Kirim ulang chat uji dari HP, tunggu 5–10 detik, lalu klik **Refresh**
   (daftar log tidak selalu bertambah sendiri).
5. Klik satu baris untuk melihat **status HTTP** dan detail baris log `[wa] ...`.

Baris log yang perlu dicari:

- `[wa] pesan diproses` → pesan diterima dan alur berjalan.
- `[wa] gagal memproses pesan` → ada error; penyebabnya ada di bagian `error`.
- `[wa] secret webhook salah atau kosong` → secret tidak cocok.
- `[wa] WA_WEBHOOK_SECRET belum diset` → environment variable belum terbaca.

### Arti status balasan

| Status & isi balasan | Artinya |
|----------------------|---------|
| `200` + `"replied": true` | Pesan diproses dan balasan sudah dikirim ke Fonnte. |
| `200` + `"ignored": "pesan-grup"`, `"nomor-bot-sendiri"`, `"tanpa-teks"`, atau `"tanpa-pengirim"` | Pesan sengaja diabaikan, bukan error. |
| `200` + `"replied": false` | Pesan diproses, tetapi tidak ada teks balasan yang perlu dikirim. |
| `401` | `secret` di URL Fonnte tidak sama dengan `WA_WEBHOOK_SECRET`. |
| `405` | Permintaan bukan POST (biasanya salah metode saat menguji manual). |
| `500` | Server error: env belum diset, Supabase menolak, atau Fonnte gagal. |

Dari terminal (kalau Vercel CLI terpasang & login):

```bash
vercel logs <URL-DEPLOYMENT> --follow
```

Arti pesan error yang umum:

| Yang muncul | Artinya | Solusi |
|-------------|---------|--------|
| `401 unauthorized` | `secret` di URL Fonnte tidak sama dengan `WA_WEBHOOK_SECRET` | Perbaiki URL di Fonnte atau nilai env, lalu redeploy |
| `500 server belum dikonfigurasi` | `WA_WEBHOOK_SECRET` belum terbaca | Isi env di Vercel, lalu redeploy |
| `[wa] gagal memproses pesan` + `SUPABASE_... belum diset` | Kunci Supabase belum ada | Isi `SUPABASE_URL` & `SUPABASE_SERVICE_ROLE_KEY`, redeploy |
| `[wa] gagal memproses pesan` + `relation "wa_sessions" does not exist` | Langkah 1 belum dijalankan | Jalankan SQL migrasi |
| `[wa] gagal memproses pesan` + `permission denied for table` | Izin tabel (GRANT) belum ada | Jalankan ulang SQL migrasi, termasuk bagian `grant ... to service_role` |
| `[wa] gagal memproses pesan` + `Supabase menolak permintaan (HTTP 401)` | Kunci Supabase salah atau sudah dinonaktifkan | Periksa `SUPABASE_SERVICE_ROLE_KEY`, lalu redeploy |
| `[wa] gagal memproses pesan` + `Fonnte menolak pesan` | Token salah / kuota habis / device terputus | Cek dashboard Fonnte |
| Tidak ada log sama sekali | Webhook tidak sampai (URL salah, Auto Read mati, atau proteksi Vercel) | Lihat bagian di bawah |

---

## Alamat pratinjau (preview) dan proteksi Vercel

Setiap cabang (branch) yang di-push mendapat alamat pratinjau sendiri, misalnya
`https://karo-git-fitur-whatsapp-nama-akun.vercel.app`.

**Masalah yang sering terjadi:** Vercel memasang **Vercel Authentication**
(proteksi login) pada alamat pratinjau, terutama untuk project di akun yang
sama dengan project produksi. Kalau alamat webhook di Fonnte memakai alamat
pratinjau yang masih terlindungi, permintaan dari Fonnte akan ditolak
(halaman login, bukan balasan JSON) dan chat tidak akan dibalas.

Dua pilihan:

- **(a) Matikan proteksi untuk pratinjau.** Vercel → Settings →
  **Deployment Protection** → matikan **Vercel Authentication** untuk
  environment **Preview** (atau atur agar "Only Preview Deployments" tidak
  memakai proteksi). Ingat: siapa pun yang tahu alamatnya bisa membuka preview,
  tapi endpoint WhatsApp tetap aman karena wajib `?secret=`.
- **(b) Gabungkan ke cabang utama setelah ditinjau.** Fitur dipakai di domain
  produksi
  (`https://DOMAIN-SAYA/api/whatsapp?secret=...`) yang tidak terkena proteksi.
  Cara ini paling aman, tapi harus menunggu review selesai.

Jangan menggabungkan ke cabang utama tanpa persetujuan pemilik project.

---

## Uji lokal tanpa WhatsApp (untuk pengembang)

```bash
npm run wa:test
```

Perintah ini menjalankan `scripts/test-whatsapp.mjs`: menyalakan server lokal,
memakai database in-memory (Supabase tidak disentuh), memakai token Fonnte
palsu, lalu menguji alur `DAFTAR` → konfirmasi, deteksi nomor ganda,
`BATAL`/`ULANG`/`BANTUAN`, serta penolakan pesan grup, pesan dari nomor bot
sendiri, pesan tanpa teks, dan secret yang salah.

Untuk mencoba lewat `curl` terhadap server lokal (`vercel dev`, port 3000):

```bash
curl -X POST "http://localhost:3000/api/whatsapp?secret=secret-palsu-uji" \
  -H "Content-Type: application/json" \
  -d '{"sender":"628111222333","message":"DAFTAR","name":"Penguji","device":"628999888777","inboxid":1}'
```

`vercel dev` tetap butuh isi `.env` lokal; untuk sekadar mencoba alur, cara
`npm run wa:test` tidak memerlukan rahasia apa pun dan tidak mengirim WhatsApp.

---

## Catatan keamanan

- Token Fonnte dan service role key hanya ada di environment variable. Kode di
  repo tidak memuat nilai rahasia.
- File `.env` sudah masuk `.gitignore`; `.env.example` hanya berisi nama variabel.
- Webhook wajib menyertakan `?secret=...` (atau header `x-webhook-secret`).
  Tanpa secret yang benar, server menjawab 401 dan tidak memproses apa pun.
- Pesan grup, pesan dari nomor bot sendiri, dan pesan tanpa teks diabaikan.
- Tabel `wa_sessions` memakai RLS tanpa policy dan hanya diberi izin tabel
  kepada `service_role`: hanya server yang bisa membaca/menulis, browser tidak
  bisa. Izin ini ditulis eksplisit di file SQL karena Supabase tidak lagi
  memberikannya otomatis untuk tabel baru.
- Pesan yang masuk hanya dipakai untuk pendataan; isi chat tidak disimpan
  selain ringkasan data pendaftaran di tabel `umat`.
