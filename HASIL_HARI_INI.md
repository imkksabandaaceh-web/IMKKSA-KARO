# 📋 HASIL PEKERJAAN — IMKKSA KARO (7, 14 & 18 Agustus 2026)

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
- Catatan: **perilaku ini sudah diubah di Fase 10** — sesi admin kini dipulihkan dari
  localStorage saat halaman dimuat ulang, jadi refresh tidak lagi meng-out admin.

---

## ✅ Fase 8 — Update ISI.pdf: Info Donasi & Narahubung + Optimasi Ukuran + Uji Browser (18 Agustus 2026)

> Admin memperbarui `public/ISI.pdf` dengan **bagian Sumbangan** (rekening Bank Mandiri a/n Efron
> Andre Tarigan, No. Rekening 1370003225261) dan **Contact Person** (3 narahubung), lalu diminta:
> update via build/git/script/supabase, pastikan file ringan, dan uji browser sungguhan.

### 8.1 Optimasi ukuran ISI.pdf (365 KB → 347 KB) — commit `ecef937`
- **Analisis isi PDF** (parsing xref + stream): font sudah *subsetted* (Aptos/Arial/Times, ±152 KB),
  gambar kecil (maks. 53 KB), stream sudah Flate-compressed, dan **tidak ada objek duplikat** →
  tidak ada ruang besar untuk dipangkas lossless.
- **Optimasi:** re-save lossless via **`pdf-lib`** (library yang sama dipakai aplikasi saat generate):
  **365.714 → 347.210 byte (±5% lebih ringan)**.
- **Verifikasi kesetaraan:** output generate (isi field cover + gabung + flatten) dari template lama
  vs baru **byte-identik** (SHA-256 sama) → konten baru (Sumbangan/narahubung) pasti ikut terbawa.
- Percobaan recompress zlib level-9 hanya hemat ±2,8% → tidak sepadan dengan risiko menulis ulang
  PDF manual. Kompresi lebih agresif butuh Ghostscript (lossy, berisiko mengubah tampilan).
- **Catatan penting:** template PDF **tidak memperlambat loading website** — hanya di-`fetch` saat
  admin klik *PROSES & GENERATE PDF* (lazy load), bukan saat halaman dibuka.

### 8.2 Deployment: build + git + supabase
- **Build:** `npm run build` (type-check `tsc -b` 0 error) → `dist/ISI.pdf` = file baru (MD5 sama
  dengan `public/`).
- **Git:** commit `ecef937` + `git push origin master` → sekaligus mengirim **4 commit yang
  sebelumnya belum ter-push** (`5b15393`, `18c8727`, `52b4403`, `6c1a0a2`) → Vercel auto-deploy.
- **Verifikasi live:** `curl https://www.imkksa-bandaaceh.site/ISI.pdf` → **347.210 byte** ✅.
- **Supabase — tidak ada yang perlu diupdate:** storage bucket **kosong** (`[]`, dicek via REST) —
  template PDF hidup di hosting statis (`public/` → `dist/` → Vercel), bukan di Supabase. Supabase
  hanya menyimpan **teks riwayat** proposal (tabel `riwayat_download`).
- **"Script"** (deploy.sh/deploy.bat) tidak dijalankan karena interaktif & pesan commit default-nya
  keliru ("hapus fitur PDF"); langkah setara dikerjakan manual (build → commit → push). Apps Script
  (`clasp`) tidak perlu di-deploy ulang — `Code.js` tidak berubah.

### 8.3 Uji browser sungguhan — semua lulus ✅ (login admin asli)
- Chrome headless via CDP (Node `WebSocket` bawaan, tanpa puppeteer): login `imkksa01@imkksa.org` →
  menu Proposal → isi pengirim/penerima 2 baris → klik **PROSES & GENERATE PDF**.
- Hasil: *"Proposal dibuat: 003/PROP/IMKKSA/VIII/2026"* → PDF `Proposal_003_PROP_IMKKSA_VIII_2026.pdf`
  (**723.304 byte**, **7 halaman** = 2 cover + 5 isi), **0 error JavaScript**.
- **Download headless tidak jatuh ke disk** → blob PDF di-intersepsi langsung di halaman
  (hook `URL.createObjectURL`), byte persis yang dihasilkan browser.
- Validasi `pdftotext`: field cover terisi (nomor, tanggal **18 Agustus 2026**, penerima 2 baris) dan
  **konten baru ISI.pdf ada semua**: Sumbangan, BANK MANDIRI a/n EFRON ANDRE TARIGAN, Rekening
  1370003225261, Contact Person (drh. Idaman Sembiring 0812-7733-8861, Serba Lazoerta Ginting
  0813-7591-1675, Bastanta Bangun 0852-9755-4841), X. PENUTUP, *Bujur ras Mejuah-juah*.
- **Bukti live == repo:** teks hasil generate live **identik** dengan generate lokal dari template repo
  (beda SHA-256 hanya karena `/ID` acak pdf-lib per save).
- **Pembersihan:** 3 baris riwayat uji (001/002/003; 002 dari percobaan skrip yang sempat menggantung)
  dihapus dari Supabase (HTTP 204 → tabel kembali `[]`); Chrome headless dimatikan; semua file/folder
  uji dihapus; `git status` bersih.

---

## ✅ Fase 9 — Perbaikan Garis Batas Nomor Surat + Optimasi Lossless + Uji Nomor 001/002 (18 Agustus 2026)

> Admin memperbaiki template PDF dengan **Nitro 8** (nomor surat yang tadinya terpotong garis batas kini tidak lagi),
> lalu diminta: update ke build/git, optimasi ukuran lossless, uji coba nomor urut 001 & 002 di browser sungguhan,
> dan hapus hasil uji agar nomor surat berikutnya mulai dari 001 lagi.

### 9.1 Perbaikan garis batas nomor surat (Nitro 8) — commit `eee93d6`
- `public/COVER.pdf` & `public/ISI.pdf` diperbarui admin via Nitro 8: **nomor surat tidak lagi terpotong garis batas**.
- Ukuran naik (COVER 415.983 → 418.531 B, ISI 347.210 → 371.366 B) karena Nitro menyimpan ulang tanpa
  optimasi pdf-lib sesi sebelumnya.
- Build → commit `eee93d6` → push → Vercel auto-deploy. Verifikasi live: COVER **418.531** byte, ISI **371.366** byte (identik repo).

### 9.2 Optimasi ukuran lossless via pdf-lib — commit `0cfa3ed`
- Re-save lossless dengan **pdf-lib** (library yang sama dipakai generate):

  | File | Sebelum | Sesudah | Hemat |
  |---|---|---|---|
  | COVER.pdf | 418.531 B | **398.499 B** | −4,8% |
  | ISI.pdf | 371.366 B | **353.133 B** | −4,9% |

- **Verifikasi kesetaraan (semua lulus ✅):**
  - Halaman utuh (COVER 2, ISI 5); field form `tujuan_surat`, `nomor_surat`, `tanggal_surat` tetap ada.
  - Teks template identik (`pdftotext` lama vs baru).
  - Hasil generate dari template lama vs baru **byte-identik** (SHA-256 sama setelah `/ID` acak dibuang)
    → posisi field & konten tidak berubah → perbaikan garis batas tetap terjaga.
- `dist/` MD5 identik `public/`; live: COVER **398.499**, ISI **353.133** byte.

### 9.3 Uji browser sungguhan: nomor urut 001 & 002 — semua lulus ✅
- Chrome headless via CDP (Node `WebSocket` bawaan, tanpa puppeteer): login admin asli `imkksa01@imkksa.org` →
  menu Proposal → isi pengirim/penerima 2 baris → klik **PROSES & GENERATE PDF**.
- **Proposal 001:** baris Supabase `001/PROP/IMKKSA/VIII/2026` (no_urut 1) ✅ · pesan UI *"Proposal dibuat:
  001/PROP/IMKKSA/VIII/2026"* ✅ · PDF **729.176 byte**, valid %PDF, field cover terisi (nomor 001,
  tanggal **18 Agustus 2026**, penerima 2 baris) ✅.
- **Proposal 002:** baris `002/PROP/IMKKSA/VIII/2026` (no_urut 2) ✅ — **penomoran berurutan MAX+1 terbukti**
  dari tabel kosong.
- **Instrumentasi:** 1 klik tombol → tepat **1 POST insert** Supabase per proposal (tidak ada submit ganda);
  0 error JavaScript; 0 exception CDP. Blob PDF di-intersepsi langsung di halaman (hook `URL.createObjectURL`),
  byte persis hasil browser.
- **Uji lanjutan (tabel tidak kosong):** 003 → 004 juga berurutan → logika `MAX(no_urut)+1` benar baik dari
  kosong maupun lanjutan.

### 9.4 Pembersihan: nomor surat kembali mulai dari 001
- Semua baris uji dihapus dari Supabase (id 16–19, HTTP 204) → tabel `riwayat_download` kembali **`[]`** →
  proposal berikutnya otomatis bernomor **001**.
- Artefak uji (skrip CDP, folder `.tmp-uji`, profil Chrome) dihapus; `git status` bersih.
- Catatan teknis: pada percobaan pertama, pesan sukses UI sempat "terlewat" oleh polling skrip karena render
  React menumpuk dengan reset form saat generate (pdf-lib memblokir main thread sejenak) — diselesaikan dengan
  MutationObserver + pemicu baris Supabase sebagai sumber kebenaran.

---

## ✅ Fase 10 — Login Tidak Logout Saat Refresh + Logout Sungguhan + PDF Lebih Tahan Banting (18 Agustus 2026)

> Jawaban atas pertanyaan admin: (1) kenapa update PDF selalu muncul error, dan (2) kenapa
> refresh selalu meng-out login admin. Keduanya diperbaiki di fase ini + diuji di browser.

### 10.1 Kenapa update PDF selalu error? (akar masalah & perbaikan)
- **Akar masalah:** setiap kali `COVER.pdf` di-export ulang dari Nitro 8/Word, software tersebut
  **meng-reset nama kotak isian form** menjadi generik (`Text1`/`Text2`/`Text3`) — bukan
  `nomor_surat`/`tanggal_surat`/`tujuan_surat` yang dicari kode saat generate. Kalau kode tidak
  menemukan field → error saat klik **PROSES & GENERATE PDF**. Tidak ada risiko kehilangan data.
- **Perbaikan 1 — fallback diperkuat (`src/utils/pdfUtils.ts`):** pemetaan otomatis kini:
  `tujuan` = field bernama `tujuan_surat` → multiline → **kotak terluas** (fallback terakhir);
  `nomor` = paling kiri; `tanggal` = paling kanan. Diuji: PDF dengan `Text1/Text2/Text3` tanpa
  flag multiline tetap terpetakan benar ✅.
- **Perbaikan 2 — pesan error jelas:** kalau tetap gagal, admin diberi tahu persis cara
  memperbaikinya di Nitro 8 (klik kanan kotak isian → Properties → beri nama `nomor_surat`,
  `tanggal_surat`, `tujuan_surat` + centang Multiline) — bukan error membingungkan.
- **Perbaikan 3 — generate sebelum simpan (`ProposalView.tsx`):** PDF dibuat & diunduh DULU,
  baru baris riwayat di-insert. Kalau generate gagal (template bermasalah), **tidak ada baris
  tersimpan & nomor surat tidak terpakai** → admin bisa perbaiki lalu coba lagi dari nomor sama.
  (Sebelumnya: baris tersimpan dulu, lalu generate gagal → baris "yatim" + nomor terlewati.)

### 10.2 Kenapa refresh meng-out login? (bukan demi kecepatan — kini diperbaiki)
- **Akar masalah:** `App.tsx` menginisialisasi `isLoggedIn = false` dan TIDAK pernah memulihkan
  sesi dari localStorage saat dimuat, padahal supabase-js sudah menyimpan sesi di browser.
  Memulihkannya hanya baca localStorage (<1 ms) — **tidak ada pengaruh ke loading**.
- **Perbaikan (`src/services/auth.ts` + `src/App.tsx`):**
  - `authService.restoreSession()` baru — saat halaman dimuat, sesi Supabase dibaca dari
    localStorage → admin **tetap login setelah refresh**.
  - `handleLogout` kini benar-benar logout: hapus key sesi `sb-*` dari localStorage secara
    sinkron (jaminan refresh pasca-logout tetap logout, walau koneksi lambat) + revoke token
    di server (best-effort). Sebelumnya tombol Logout hanya reset state UI — sesi Supabase di
    browser masih hidup.

### 10.3 Uji browser (build produksi lokal `vite preview`, login admin asli) — semua lulus ✅
| Cek | Hasil |
|---|---|
| Login admin | ✅ Nav menampilkan Logout Admin |
| **Refresh → masih login** | ✅ Sesi dipulihkan dari localStorage (sebelumnya auto-logout) |
| Klik Logout → langsung logout | ✅ UI logout seketika, key sesi `sb-*` hilang dari localStorage |
| **Refresh pasca-logout → tetap logout** | ✅ (sebelumnya sesi muncul lagi) |
| Alur proposal baru (generate→insert) | ✅ Pesan "Proposal dibuat: 001/PROP/IMKKSA/VIII/2026" tampil, PDF 729.175 byte valid (nomor, tanggal 18 Agustus 2026, penerima 2 baris), baris Supabase no_urut 1, 0 error JS |
| Fallback field (uji sintetis) | ✅ `Text1/Text2/Text3` tanpa multiline terpetakan; tanpa field → pesan error jelas |
- Baris uji proposal dihapus (HTTP 204) → tabel `riwayat_download` kembali `[]` (nomor mulai dari 001).
- Detail teknis logout: `signOut()` bawaan auth-js menghapus sesi lokal HANYA SETELAH panggilan
  server selesai — kalau pengguna refresh di tengah jalan, sesi tersisa. Solusinya: hapus key
  `sb-*` langsung (sinkron) lalu revoke server sebagai best-effort.

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
ecef937  Perbarui ISI.pdf: tambah info donasi & narahubung, optimasi ukuran (365 KB → 347 KB)
eee93d6  Perbarui template PDF cover & isi: perbaiki nomor surat terpotong garis batas (Nitro 8)
0cfa3ed  Optimasi ukuran template PDF: re-save lossless via pdf-lib (COVER 419→399 KB, ISI 371→353 KB)
<next>   Login tidak logout saat refresh + logout sungguhan + PDF lebih tahan banting (fallback & pesan error)
```
