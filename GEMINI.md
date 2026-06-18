# Proyek: KARO

## Deskripsi
Aplikasi web untuk informasi jemaat IMKKSA Banda Aceh sekitar, dibangun menggunakan React + Vite + TypeScript.

## Status Terakhir
- **Frontend:** Menggunakan React 19 dan Vite 8.
- **Fitur Utama:**
  - Landing page dengan informasi jadwal ibadah dan organisasi.
  - Sistem login Admin menggunakan **Supabase Auth**.
  - Dashboard Admin untuk mengedit konten halaman secara langsung.
  - Integrasi dengan **Supabase** untuk tracking riwayat download proposal (real-time).
  - Integrasi dengan Google Apps Script (`SCRIPT_URL`) untuk penyimpanan konten halaman dan data umat.
- **Struktur File:**
  - `src/components/`: Berisi komponen UI seperti `LoginForm`, `AdminDashboard`, `DownloadProposal`, dll.
  - `src/services/auth.ts`: Logika autentikasi menggunakan Supabase.
  - `src/services/supabase.ts`: Konfigurasi dan klien Supabase.
  - `src/App.tsx`: Komponen utama yang mengatur routing, state aplikasi, dan polling data.

## Panduan Pengembangan
- Pastikan perubahan disinkronkan ke Google Drive melalui API yang tersedia.
- Folder `node_modules`, `dist`, dan `.vercel` diabaikan dalam pembacaan konteks untuk menghemat kuota.
