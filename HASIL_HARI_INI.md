# 📋 HASIL PEKERJAAN — IMKKSA KARO (7 & 14 Agustus 2026)

> Dokumen ini merangkum **seluruh pekerjaan** yang dilakukan dalam sesi ini agar mudah
> ditinjau ulang (misalnya dengan bantuan AI/Claude). Semua perubahan sudah di-commit
> dan di-push ke GitHub, serta sebagian sudah aktif di server live.

---

## 🎯 Latar Belakang & Masalah

Situs IMKKSA KARO direncanakan menampung **±60 keluarga baru**, masing-masing dengan
**Pas Foto** dan **Kartu Keluarga** (2 file/family). Dengan arsitektur lama:

| Masalah | Detail |
|---|---|
| **Batas 500 KB** | Semua data disimpan di Script Properties Apps Script (maks. 500 KB per script) |
| **Risiko timeout 6 menit** | Foto base64 dikirim semua sekaligus saat Simpan → upload berurutan ke Drive dalam 1 eksekusi |
| **Polling boros** | Semua pengunjung mengunduh semua data tiap 15 detik → kuota Apps Script (90 menit/hari) cepat habis |
| **Data tidak terpusat** | Data anggota belum tersentuh Supabase (hanya login admin) |

---

## ✅ Fase 1 — Optimasi Cepat (commit `39044c2`)

### 1.1 Upload foto/KK langsung saat file dipilih (bukan saat Simpan)
- **Sebelum:** file di-*compress* jadi base64, disimpan di form, dan SELURUH array umat
  (termasuk semua base64) dikirim sekali jalan saat tombol Simpan → payload raksasa, rawan timeout.
- **Sesudah:** saat file dipilih → langsung di-*compress* → **upload ke Google Drive** via
  Apps Script → hanya **URL** yang disimpan di form.
- File diubah: `src/App.tsx` (fungsi `handleFileChange`, kini async-upload ke Drive),
  `src/App.css` (indikator *"⏳ Mengunggah ... ke Google Drive"* + animasi).

### 1.2 Polling hemat
- Interval polling **15 detik → 60 detik**, dan hanya berjalan saat:
  - **Admin sudah login**, dan
  - **Tab browser aktif** (via `visibilitychange`, refresh saat kembali ke tab).
- Efek: kuota Apps Script jauh lebih hemat.

### 1.3 Folder khusus dokumen anggota (deploy Apps Script v3)
- `Code.js` mendukung parameter `folder: 'IMKKSA_Anggota_Dokumen'` pada aksi `uploadImage`.
  Foto/KK anggota masuk folder khusus, tidak tercampur folder `IMKKSA_Beranda_Images`.
- Backward-compatible: upload lama (logo, pengurus, editor) tetap ke folder default.

---

## ✅ Fase 2 — Migrasi Data Anggota ke Supabase (commit `56ea9b3`)

### 2.1 Skema database (`supabase/migrasi_umat.sql`)
```sql
create table if not exists public.umat (
  id text primary key,
  nama text not null,
  status text not null default 'Anggota',
  nik text, alamat text, no_hp text,
  photo text, kk text,
  is_pending boolean not null default false,
  tempat_lahir text, tanggal_lahir text,
  created_at timestamptz not null default now()
);
-- + RLS + index (nama trgm, is_pending, status)
```

### 2.2 Row Level Security (RLS)
| Policy | Aturan |
|---|---|
| **Publik baca anggota disetujui** | `select` hanya `is_pending = false` |
| **Publik daftar anggota (pending)** | `insert` hanya dengan `is_pending = true` → *pengunjung bisa mendaftar tapi otomatis pending* |
| **Admin kelola semua umat** | `for all` hanya role `authenticated` |

### 2.3 Service Supabase (`src/services/umat.ts` — file baru)
- `fetchApproved()` — publik: hanya anggota disetujui, **tanpa kolom NIK/KK** (privasi), pencarian `ilike`.
- `fetchAll()` — admin (sesi login): semua baris termasuk pending + NIK/KK.
- `upsert()` / `remove()` — simpan/hapus **per record** (payload kecil & cepat).

### 2.4 `src/App.tsx`
- Data umat dimuat dari **Supabase** (admin: semua; publik: hanya disetujui).
- **Migrasi otomatis 1x**: saat admin login pertama kali & Supabase kosong → data lama
  ditarik dari Apps Script/localStorage, base64 foto/KK di-upload dulu ke Drive, lalu
  dimasukkan ke Supabase.
- Semua handler (simpan, edit, hapus, approve, tolak, daftar publik) kini menulis ke **Supabase**.
- **Fix bug baris ganda**: update data dengan nama yang sama kini *update-in-place* (pakai id
  record lama), tidak meninggalkan duplikat.
- **Lindungi cache lokal** (commit `5382c24`): data lama tidak lagi tertimpa kosong oleh
  respons Supabase yang masih kosong sebelum migrasi selesai.

### 2.5 Pembersihan Apps Script (commit `265e2d4`, deploy v4)
- Data `umat` **dihapus dari Code.js** (payload `getSiteData` tidak lagi membawa umat).
- Respons polling turun: **7.750 → 6.082 bytes** dan tidak membesar lagi seiring bertambahnya keluarga.
- **Hasil verifikasi migrasi:** 4 anggota berhasil termigrasi (Bastanta Bangun, Enma Aspita
  Maibang, Darsius Ginting, Harmenita Br Sitepu) — `is_pending: false`.

---

## ✅ Fase 3 — Panel Admin Approve/Reject Pendaftaran (commit berikutnya)

> Kolom status (`is_pending`) dan RLS **sudah terpasang sejak fase 2**. Fase ini
> **menyempurnakan panel admin** agar verifikasi lebih cepat & informatif.

### 3.1 Verifikasi RLS (teruji langsung ke Supabase)
| Uji | Hasil |
|---|---|
| Anon insert `is_pending = false` | ❌ **Ditolak** (RLS blokir) |
| Anon insert `is_pending = true` | ✅ **Diterima** |
| Anon `select` hanya melihat `is_pending = false` | ✅ |

### 3.2 Peningkatan panel antrean (src/App.tsx + src/App.css)
- **Banner notifikasi kuning berdenyut**: *"⚠️ N pendaftaran baru menunggu persetujuan"*
  → klik untuk lompat ke antrean (`#pending-queue`).
- **Tabel antrean diperkaya** — kolom:
  - *Nama & Kontak* (No. HP + 4 digit terakhir NIK)
  - *Dokumen* (thumbnail **Pas Foto** & **Kartu Keluarga**; hover membesar, klik → detail)
  - *Diajukan* (tanggal pendaftaran dari id `pending_<timestamp>`)
  - *Status* (badge "Menunggu Verifikasi")
  - *Aksi*: `Detail` | `✔ Approve` | `Edit` | `✕ Tolak`
- **Fix perilaku**: mengedit record pending tidak lagi auto-approve diam-diam — muncul
  konfirmasi *"Simpan sekaligus setujui?"* (OK = setujui, Batal = tetap di antrean).
- CSS baru: `.pending-banner`, `.pending-docs`, `.doc-thumb`, `.doc-none`.

---

## ✅ Fase 4 — Notifikasi Email Pendaftaran Baru (commit berikutnya)

> Follow-up: admin diberi tahu lewat email setiap kali ada pendaftaran mandiri masuk antrean.

### 4.1 Backend (`Code.js`, deploy Apps Script v5 → v6)
- Aksi baru `kirimNotifikasiPendaftaran` di `doPost`:
  - Mengirim email ke **`ADMIN_EMAIL`** (`imkksabandaaceh@gmail.com`) berisi nama, No. HP, dan alamat pengaju.
  - **Proteksi spam:** setiap id hanya boleh memicu 1 email dalam 6 jam (via `CacheService`).
  - Hanya menerima id berawalan `pending_`.
- `appsscript.json`: tambah `oauthScopes` (`drive` + `script.send_mail`) — **wajib diotorisasi sekali oleh pemilik script**.

### 4.2 Frontend (`src/App.tsx`)
- Setelah pendaftaran publik berhasil tersimpan ke Supabase → panggilan fire-and-forget ke
  Apps Script (`mode: 'no-cors'`, tidak mengganggu alur pengguna) untuk memicu email admin.

### 4.3 Hasil verifikasi
- **✅ Email terkirim & terverifikasi:** log editor *"Email uji terkirim ke imkksabandaaceh@gmail.com"* dan
  endpoint web app merespons `{"success":true}`.
- **Proses otorisasi** (kunci sukses): deployment web app harus dibuat **via UI editor**
  (Deploy → New deployment) + fungsi `testKirimEmailUji` dijalankan di editor dengan akun
  **imkksabandaaceh@gmail.com** (pemilik script) agar scope `script.send_mail` disetujui.
- **URL situs berubah** → `SCRIPT_URL` di `App.tsx` diperbarui ke deployment baru.
- **RLS diuji ulang menyeluruh:** insert anon `is_pending=true` → 201 (diterima) dalam semua
  variasi kolom; anon `select` hanya melihat anggota disetujui; anon `delete` → 0 baris (diblokir RLS).
- `doGet` diperkeras agar aman dijalankan manual dari editor (e tanpa parameter).

---

## ✅ Fase 5 — Optimasi Galeri: Foto Cepat di HP (14 Agustus 2026)

> Masalah: foto di menu Galeri **sangat lambat muncul di HP**, padahal cepat di laptop.
> Diselesaikan dengan cache berlapis (klien + server) plus tombol segarkan manual.

### 5.1 Akar masalah (hasil pengukuran langsung ke server)
- Daftar foto tiap album diambil dari Google Apps Script (`listFolder`) → **±1,6–2,1 dtk per album** dari koneksi cepat; lebih lama lagi di HP (RTT tinggi + rantai redirect).
- Ada **9 album**; tiap album nge-load sendiri-sendiri saat discroll (IntersectionObserver) → tiap album muncul spinner "Memuat foto..." 2–5 dtk.
- Cache lama hanya `sessionStorage` **dan** hanya disimpan kalau list LENGKAP (setelah klik "Lihat Semua") → setiap buka halaman baru, semua album fetch ulang dari Apps Script.
- Gambar-gambarnya sendiri **sudah cepat** (ImageKit, cache HTTP 1 tahun, thumbnail ±20 KB) — yang lambat adalah **daftar file**, bukan gambarnya.

### 5.2 Perbaikan klien — cache localStorage (commit `05bf850`)
- `src/components/GaleriView.tsx`: daftar foto tiap album (termasuk versi preview) disimpan di **localStorage** dengan TTL.
- Kunjungan ulang → foto tampil **instan** dari cache, lalu refresh di background.
- Kalau refresh gagal tapi masih ada cache → foto lama tetap tampil (tidak ditimpa layar error).

### 5.3 Perbaikan server — CacheService (commit `05bf850`, deploy v10)
- `Code.js` `listFolder`: hasil daftar foto disimpan di **`CacheService`** (global per script, dipakai semua pengunjung) → pengunjung pertama kali & refresh background tidak lagi menunggu iterasi DriveApp.
- **Hasil uji A/B** (folder 34 file, median 4 putaran):

  | Tanpa cache (v9) | Dengan cache (v10/v11) |
  |---|---|
  | ±1,85 dtk | ±1,42 dtk |

- Sisa ±1,3 dtk adalah **overhead tetap Apps Script** (spin-up container + redirect) yang tidak bisa dihilangkan dengan caching.

### 5.4 Tombol "Segarkan Foto" + TTL 2 jam (commit `c2de41f`, deploy v11)
- `Code.js`: `listFolder` menerima `refresh=1` → **memaksa hitung ulang langsung dari Google Drive** dan memperbarui cache server (tidak menunggu TTL).
- `GaleriView.tsx`: tombol **"🔄 Segarkan Foto"** per album (di samping tombol "Lihat Semua") → admin upload foto baru ke folder Drive → klik tombol → foto baru langsung muncul.
- TTL cache server & klien diturunkan **6 jam → 2 jam** supaya foto baru juga muncul otomatis lebih cepat.

### 5.5 Deployment & verifikasi
- Apps Script: **v10 → v11** (`AKfycbwQB...AoRhg`); v9 & v10 dihapus setelah situs terbukti memakai URL baru.
- `SCRIPT_URL` di `App.tsx` + `.env` diperbarui setiap pindah deployment; Vercel auto-deploy dari git push.
- Bundle produksi diverifikasi (grep) memakai URL deployment terbaru; `listFolder` normal, `refresh=1`, dan content utama semuanya HTTP 200.

---

## 📦 Arsitektur Akhir

| Komponen | Tempat penyimpanan | Keterangan |
|---|---|---|
| **Data anggota (umat)** | **Supabase (Postgres)** | Cepat, scalable, RLS aktif |
| **Foto & Kartu Keluarga** | **Google Drive** (folder `IMKKSA_Anggota_Dokumen`) | Upload langsung saat pilih file, simpan URL-nya |
| **Halaman/settings/pengurus/galeri** | Apps Script Script Properties | Tetap, payload polling kini ringan |
| **Login admin** | Supabase Auth | `username@imkksa.org` / email |

---

## 🚀 Status Deployment Apps Script (clasp)

| Deployment | Versi | Isi |
|---|---|---|
| `AKfycbwQBw4FIHWE7EVvs...` (**URL SITUS AKTIF**) | **v11** | Cache `listFolder` (CacheService 2 jam) + `refresh=1` + tombol "Segarkan Foto" (14/08/2026) |
| `AKfycbwNFgAKXmoc0R...` (@HEAD) | HEAD | Deployment pengembangan (dev) |
| ~~`AKfycbwToHfqmEp4uwwRc...`~~ | ~~v10~~ | ~~Cache `listFolder` (6 jam)~~ — **sudah dihapus** (14/08/2026, setelah situs live memakai v11) |
| ~~`AKfycbweKv2UIvRo7nDs...`~~ | ~~v9~~ | ~~Folder anggota + notifikasi email + scope MailApp~~ — **sudah dihapus** (14/08/2026, setelah situs live memakai v10) |
| ~~`AKfycbyaEatvxMhJfw...`~~ | ~~v8~~ | ~~Deployment lama~~ — **sudah dihapus** (28/07/2026, setelah situs live terbukti memakai URL baru) |

---

## 📌 Langkah yang Tersisa (diperlukan user)

1. **Otorisasi scope MailApp (wajib, sekali saja):** buka Apps Script editor (project IMKKSA) →
   otorisasi ulang → izinkan. Setelah ini, email notifikasi berfungsi. Tanpa ini, semua aksi
   Apps Script akan gagal dengan error izin.
2. **Bersihkan baris uji antrean** (±5 baris: *Uji Verifikasi*, *Uji Map 1*, *Uji A/B/C*) →
   login admin → Data Anggota → **Antrean Persetujuan** → klik **Tolak** untuk masing-masing
   (sekaligus menguji panel baru).
3. Opsional: WhatsApp notification (perlu Meta Business verification) jika diinginkan.
4. Opsional: email notifikasi juga bisa dikirim saat admin login menemukan antrean baru.

---

## 🔗 Referensi Commit

```
39044c2  Optimasi: upload foto/KK langsung ke Drive saat pilih file + polling hemat
56ea9b3  Fase 2: migrasi data anggota ke Supabase (baca/tulis langsung, migrasi 1x, fix baris ganda)
5382c24  Lindungi cache lokal umat agar tidak tertimpa kosong sebelum migrasi
265e2d4  Code.js: hapus umat dari Apps Script, respons polling lebih ringan
5f682e2  Panel admin approve/reject + dokumen ini
<latest> Notifikasi email pendaftaran baru + scope MailApp
05bf850  Optimasi galeri: cache daftar foto di localStorage + CacheService Apps Script
c2de41f  Galeri: tombol "Segarkan Foto" (refresh=1) + TTL cache diturunkan ke 2 jam
```
