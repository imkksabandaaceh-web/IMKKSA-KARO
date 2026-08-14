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

## ✅ Fase 6 — Perbaikan Halaman Kosong & Aktivasi Type-Check (14 Agustus 2026)

> Setelah A.Panel diperluas, situs tampil **kosong (halaman putih)**. Bukan masalah
> build/git — bundle yang dilayani Vercel sudah yang terbaru, tapi ada **bug runtime**
> yang membuat seluruh aplikasi crash.

### 6.1 Akar masalah halaman kosong (commit `3577b5c`)
- **Gejala:** situs merespons HTTP 200 tapi tampil putih tanpa konten.
- **Diagnosis:** bundle produksi (`index-B7nc-Yvt.js`) hash-nya sama persis dengan build lokal →
  Vercel sudah melayani kode terbaru; masalahnya bukan deploy basi.
- **Akar:** fitur baru "sembunyikan menu" di `src/App.tsx` memakai `useMemo(...)` tapi
  `useMemo` **tidak di-import** dari React. Karena file diawali `// @ts-nocheck`, TypeScript
  tidak memeriksa file ini → `npm run build` lolos, namun di browser `useMemo` bernilai
  `undefined` → `TypeError: useMemo is not a function` → seluruh app crash.
- **Perbaikan:** tambahkan `useMemo` ke import React (satu baris).

### 6.2 Aktivasi type-check di App.tsx (commit `e7953b4`)
- **Motivasi:** `@ts-nocheck` membuat bug seperti di atas lolos ke produksi.
- **Perubahan:** hapus `// @ts-nocheck` dari `src/App.tsx` → `npm run build` (via `tsc -b`)
  kini **gagal** bila ada error tipe, sehingga bug kelas ini tidak akan terulang.
- **Error tipe yang ikut diperbaiki (3):**
  - Hapus helper mati `getFolderEmbedUrl` (tidak pernah dipakai).
  - `doc.setFont(undefined, 'bold'/'normal')` → `doc.setFont('helvetica', ...)`
    (perilaku runtime sama — sebelumnya default ke helvetica).
- **Verifikasi:** `tsc -b` → 0 error; `npm run build` → lolos; Vercel redeploy otomatis
  (bundle baru `index-BGEKL5Zy.js` terverifikasi live).

### 6.3 Audit keep-alive Supabase (UptimeRobot + GitHub Actions)
- **Latar:** Supabase free tier me-pause project setelah 7 hari tanpa aktivitas API.
- **UptimeRobot dicek via API read-only** (monitor `Supabase Keep-Alive`, id `803521006`):

  | Item | Nilai | Status |
  |---|---|---|
  | URL target | `https://vqjcbmnhfrjxooavbkxc.supabase.co/rest/v1/riwayat_download?...` | ✅ Project sama dengan situs |
  | Status monitor | UP | ✅ |
  | Interval | 300 detik (5 menit) | ✅ Jauh di bawah batas 7 hari |
  | HTTP response | 200 OK | ✅ |

- **Kesimpulan:** tidak ada perubahan yang diperlukan. Supabase menghitung aktivitas per
  project (bukan per tabel), jadi ping ke tabel `riwayat_download` menjaga seluruh project.
- **Catatan penting:** monitoring situs Vercel saja **tidak** mencegah pause Supabase
  (UptimeRobot tidak menjalankan JS situs); monitor harus mengarah ke endpoint Supabase
  langsung — dan ini sudah benar.
- **Lapis ganda:** selain UptimeRobot, ada GitHub Actions `.github/workflows/keep-alive.yml`
  (ping tiap Minggu & Rabu). Risiko database ter-pause praktis nol.

---

## ✅ Fase 7 — Proposal: Template PDF Baru + Pengujian Menyeluruh (14 Agustus 2026)

> Fitur **Menu Proposal** (generate PDF otomatis bernomor + riwayat Supabase) sudah ada
> sejak commit `8993b79`. Hari ini template PDF-nya diperbarui & dinamai ulang, pemetaan
> field dibuat otomatis, lalu **seluruh alur diuji di browser sungguhan** (termasuk login admin).

### 7.1 Template COVER.pdf & ISI.pdf baru (commit `5b15393`)
- Admin memperbarui `public/COVER.pdf` (kotak isian: **nomor surat**, **tanggal** otomatis saat generate,
  dan **tujuan/penerima 2 baris**) serta `public/ISI.pdf` (proposal 5 halaman).
- **Masalah ditemukan:** field form di COVER baru bernama `Text1`/`Text2`/`Text3` (bukan
  `nomor_surat`/`tanggal_surat`/`tujuan_surat`) → kode lama akan error saat generate.
- **Perbaikan (`src/utils/pdfUtils.ts`):** fungsi `resolveCoverFields` — utamakan nama field
  yang dikenal, lalu **fallback otomatis berdasarkan karakteristik & posisi**:
  - `tujuan` = field multiline (kotak besar 2 baris),
  - `nomor` = field paling kiri, `tanggal` = field paling kanan.
  → tahan banting jika template di-export ulang dan nama field berubah lagi.
- **Struktur terverifikasi:** COVER 2 halaman (halaman 1 = kop + field isian, halaman 2 = isi surat
  + tanda tangan), ISI 5 halaman → hasil gabung **7 halaman**, tanpa duplikasi konten.

### 7.2 Penamaan field form di COVER.pdf (commit `18c8727`)
- Admin lupa memberi nama kotak isian → field di-rename **langsung di file PDF**:
  `Text1` → `tujuan_surat`, `Text2` → `nomor_surat`, `Text3` → `tanggal_surat`
  (sama persis dengan nama yang dicari kode; `tujuan_surat` tetap multiline).

### 7.3 Pengujian menyeluruh — semua lulus ✅
| Lapisan uji | Cara | Hasil |
|---|---|---|
| **Logika generate** | Node + `pdftotext` (isi field, flatten, gabung) | ✅ Nomor, tanggal, penerima 2 baris terisi benar; 7 halaman |
| **Browser tanpa login** | Chrome headless via CDP: generate+download dengan logika persis produksi | ✅ 1 file PDF valid terunduh; insert/delete riwayat via REST (HTTP 201/204) |
| **UI lengkap + login asli** | Chrome headless: login admin → menu Proposal → isi form → klik **PROSES & GENERATE PDF** | ✅ **23/23 cek lulus** |

Detail uji UI lengkap (login `imkksa01@imkksa.org`):
- Login admin sukses → form admin Proposal muncul → form diisi (pengirim + penerima 2 baris).
- Klik PROSES → pesan *"Proposal dibuat: 001/PROP/IMKKSA/VIII/2026"*.
- **Download = 1 file** `Proposal_001_PROP_IMKKSA_VIII_2026.pdf`, valid (%PDF), isi lengkap.
- **Riwayat tersimpan** di Supabase (tampil di tabel UI + row di DB) → klik 🗑️ Hapus → row hilang dari UI & DB → database kembali bersih.

### 7.4 Kesimpulan arsitektur (hasil Q&A)
- **PDF hasil generate TIDAK pernah masuk database** — dibuat **client-side** di browser
  (template di-`fetch` dari hosting statis), lalu langsung ter-unduh ke perangkat pengguna.
  Supabase hanya menyimpan **teks riwayat** (~200 byte/proposal).
- Template hidup di **server hosting** (`public/` → `dist/` → Vercel), bukan di laptop →
  situs & generate tetap berfungsi saat laptop dimatikan; laptop hanya perlu saat update template.
- Tombol ⬇️ Unduh di riwayat **membuat ulang** PDF dari template + teks tersimpan → bisa
  diunduh berkali-kali dari perangkat berbeda tanpa menyimpan file PDF.
- **Penomoran surat:** `MAX(no_urut) + 1`; jika tabel `riwayat_download` kosong, nomor
  mulai lagi dari `001`.
- Catatan: `App.tsx` tidak me-restore sesi admin dari localStorage — status login hanya
  benar setelah login sungguhan lewat Supabase Auth (bukan bug, perilaku bawaan).

---

## 📦 Arsitektur Akhir

| Komponen | Tempat penyimpanan | Keterangan |
|---|---|---|
| **Data anggota (umat)** | **Supabase (Postgres)** | Cepat, scalable, RLS aktif |
| **Foto & Kartu Keluarga** | **Google Drive** (folder `IMKKSA_Anggota_Dokumen`) | Upload langsung saat pilih file, simpan URL-nya |
| **Halaman/settings/pengurus/galeri** | Apps Script Script Properties | Tetap, payload polling kini ringan |
| **Login admin** | Supabase Auth | `username@imkksa.org` / email |
| **Template PDF (cover+isi)** | **Hosting statis** (`public/` → `dist/`) | Di-fetch browser saat generate; tidak tersimpan di DB |
| **Riwayat proposal** | **Supabase** (tabel `riwayat_download`) | Hanya teks: nomor, pengirim, penerima, tanggal, no_urut |

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
3577b5c  Fix: import useMemo yang hilang di App.tsx (crash halaman kosong)
e7953b4  Aktifkan type-check di App.tsx: hapus @ts-nocheck
8993b79  Menu Proposal: generate PDF otomatis bernomor + riwayat Supabase
5b15393  Perbarui template PDF cover/isi + petakan field form secara otomatis
18c8727  Beri nama field form di COVER.pdf (nomor_surat, tanggal_surat, tujuan_surat)
```
