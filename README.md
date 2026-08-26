# IMKKSA Banda Aceh — Website Resmi

Situs web resmi **Ikatan Masyarakat Karo Kristen Sada Arih (IMKKSA) Banda Aceh Sekitar**. Platform digital untuk pengelolaan anggota, galeri kegiatan, proposal surat, dan informasi kepengurusan organisasi.

🔗 **Live:** [imkksa-bandaaceh.site](https://www.imkksa-bandaaceh.site/)

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, TypeScript, Vite 8 |
| Database & Auth | Supabase (PostgreSQL + Row Level Security) |
| File Storage | Google Drive (foto/KK anggota) |
| CDN | ImageKit (proxy & optimasi gambar) |
| Backend Sync | Google Apps Script (data settings, galeri, notifikasi email) |
| Hosting | Vercel (auto-deploy dari GitHub) |

---

## Fitur Utama

- **Data Anggota** — CRUD anggota dengan foto & KK, verifikasi admin, export Excel/PDF
- **Galeri Kegiatan** — album berbasis folder Google Drive, lazy-load & cache
- **Proposal Surat** — generate PDF otomatis bernomor dari template, riwayat tersimpan di Supabase
- **Admin Panel (A.Panel)** — kustomisasi tema, pengaturan visibility menu, pengelolaan pengurus
- **Login Admin** — autentikasi Supabase Auth, sesi persisten (tidak logout saat refresh)
- **Pendaftaran Mandiri** — pengunjung bisa mendaftar sendiri, masuk antrean verifikasi admin
- **Notifikasi Email** — otomatis kirim email ke admin saat ada pendaftaran baru

---

## Arsitektur

```
┌─────────────┐     ┌──────────────┐     ┌────────────────┐
│  React SPA  │────▶│  Supabase    │────▶│  PostgreSQL    │
│  (Vercel)   │     │  (Auth+DB)   │     │  (RLS aktif)   │
└──────┬──────┘     └──────────────┘     └────────────────┘
       │
       ├──▶ Google Drive (foto/KK anggota, folder khusus)
       ├──▶ ImageKit CDN (proxy gambar + optimasi)
       └──▶ Google Apps Script (settings, galeri, notifikasi email)
```

- **Data anggota** disimpan di Supabase (Postgres) — cepat, scalable, RLS aktif
- **Foto & Kartu Keluarga** di-upload langsung ke Google Drive saat file dipilih
- **Settings, galeri, pengurus** disinkronkan via Google Apps Script
- **Template PDF** di-host di Vercel (static), di-fetch browser saat generate

---

## Setup Lokal

### Prerequisites

- Node.js 18+
- npm atau pnpm

### 1. Clone & Install

```bash
git clone https://github.com/your-repo/karo.git
cd karo
npm install
```

### 2. Environment Variables

```bash
cp .env.example .env
```

Isi file `.env` dengan kredensial Supabase dan ImageKit kamu (lihat `.env.example` untuk referensi).

### 3. Jalankan Development Server

```bash
npm run dev
```

Buka [http://localhost:5173](http://localhost:5173)

### 4. Build untuk Produksi

```bash
npm run build
npm run preview  # preview build di http://localhost:4173
```

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Jalankan development server |
| `npm run build` | Type-check + build untuk produksi |
| `npm run lint` | Jalankan ESLint |
| `npm run preview` | Preview build produksi |

---

## Struktur Project

```
├── public/              # Static assets (logo, template PDF, sitemap)
├── src/
│   ├── components/      # React components
│   │   ├── APanel.tsx       # Admin panel (theme settings)
│   │   ├── AdminDashboard.tsx  # Rich text editor untuk konten halaman
│   │   ├── GaleriView.tsx   # Galeri album berbasis Google Drive
│   │   ├── LoginForm.tsx    # Login admin
│   │   ├── ProposalView.tsx # Generate & kelola proposal PDF
│   │   └── ...
│   ├── services/        # API & database layer
│   │   ├── auth.ts          # Supabase Auth
│   │   ├── supabase.ts      # Supabase client
│   │   └── umat.ts          # CRUD data anggota
│   ├── utils/           # Utility functions
│   │   ├── imageUtils.ts    # Compress & ImageKit URL
│   │   └── pdfUtils.ts      # Generate PDF proposal
│   ├── App.tsx          # Main application
│   └── main.tsx         # Entry point
├── google-script/       # Google Apps Script backend
│   └── Code.js
├── supabase/            # Database migrations
└── index.html           # HTML entry point (SEO meta tags)
```

---

## Deployment

Project ini ter-deploy otomatis ke **Vercel** setiap push ke branch `master`.

### Google Apps Script

Untuk deploy perubahan pada `google-script/Code.js`:

```bash
# Install clasp globally
npm install -g @google/clasp

# Login ke Google Account
clasp login

# Deploy
cd google-script
clasp push
```

### Supabase

Migration SQL ada di folder `supabase/`. Jalankan di SQL Editor Supabase untuk setup awal.

---

## License

© 2026 IMKKSA Banda Aceh Sekitar. All Rights Reserved.
