# 📋 HASIL PEKERJAAN — IMKKSA KARO (7 Agustus 2026)

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
| `AKfycbyaEatvxMhJfw...` (URL situs, tidak berubah) | **v3** → **v4** | Folder anggota + bersihkan umat |

---

## 📌 Catatan / Langkah yang masih bisa dilakukan

1. **Hapus data uji** `Test Pendaftaran Publik` (baris `test_pending_verif`) → login admin →
   Data Anggota → **Antrean Persetujuan** → klik **Tolak** (sekaligus menguji panel baru).
2. **Notifikasi admin** saat ada pendaftaran baru (email via Apps Script `MailApp`) — direncanakan
   sebagai langkah lanjutan.
3. Opsional: WhatsApp notification (perlu Meta Business verification) jika diinginkan.

---

## 🔗 Referensi Commit

```
39044c2  Optimasi: upload foto/KK langsung ke Drive saat pilih file + polling hemat
56ea9b3  Fase 2: migrasi data anggota ke Supabase (baca/tulis langsung, migrasi 1x, fix baris ganda)
5382c24  Lindungi cache lokal umat agar tidak tertimpa kosong sebelum migrasi
265e2d4  Code.js: hapus umat dari Apps Script, respons polling lebih ringan
<latest> Panel admin approve/reject + dokumen ini
```
