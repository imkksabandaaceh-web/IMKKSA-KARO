# Backup Catatan Migrasi: IMKKSA-MIGRATION-8AFB1C

## Status Terakhir (14 Juli 2026)
1. **Pelepasan Domain Lama:**
   - Domain `www.imkksa-bandaaceh.site` telah berhasil dihapus dari Vercel Dashboard akun lama (`imkksa-karo`).
2. **Pemasangan Domain Baru:**
   - Domain `www.imkksa-bandaaceh.site` telah berhasil ditambahkan ke proyek baru (`imkksa-karo-qxsq`).
   - Status domain di dashboard Vercel baru sudah menunjukkan:
     - **Nameservers:** Third Party
     - **Vercel CDN:** Active (Centang Hijau / Valid)
   - Konfigurasi DNS di Rumahweb **tidak diubah** dan tetap mengarah ke server Vercel.

---

## Analisis Masalah (404: DEPLOYMENT_NOT_FOUND)
Meskipun status di dashboard Vercel sudah aktif (hijau), saat mengakses domain memunculkan pesan error `404: NOT_FOUND (DEPLOYMENT_NOT_FOUND)`. Ada beberapa kemungkinan penyebabnya:

1. **Penyebab A: Cache DNS / Propagasi Server (Paling Sering Terjadi)**
   - Browser atau DNS lokal Anda masih menyimpan cache respons error 404 dari waktu sebelum domain dipindahkan secara penuh.
   - *Solusi:* Tunggu beberapa waktu atau coba akses menggunakan perangkat lain (misal handphone menggunakan paket data seluler) atau melalui mode Incognito dengan koneksi jaringan berbeda.

2. **Penyebab B: Kesalahan Target Branch Produksi di Vercel**
   - Berdasarkan screenshot, deployment proyek baru berada di branch `master`.
   - Secara default, proyek Vercel baru menganggap branch `main` sebagai branch produksi (Production Branch). Jika branch produksi default di Vercel diatur ke `main`, maka deployment di branch `master` akan dianggap sebagai **Preview Deployment** sehingga tidak otomatis dihubungkan ke domain utama (`www.imkksa-bandaaceh.site`).
   - *Solusi:* Masuk ke **Settings -> Git** di dashboard proyek baru, lalu ubah **Production Branch** dari `main` menjadi `master`.

3. **Penyebab C: Konfigurasi Redirect Domain Utama**
   - Jika yang ditambahkan hanya `www.imkksa-bandaaceh.site` tanpa domain apex `imkksa-bandaaceh.site` (atau sebaliknya), Vercel mungkin belum me-route request dengan benar.

---

## Langkah Selanjutnya (Besok)
Saat kita melanjutkan pekerjaan besok, langkah-langkah yang akan kita lakukan adalah:
1. Mengecek kembali apakah domain sudah bisa diakses (untuk memastikan apakah masalahnya hanya karena propagasi cache).
2. Jika masih error 404, kita akan memeriksa pengaturan **Production Branch** di **Settings -> Git** pada proyek baru untuk memastikan branch produksinya mengarah ke `master` (sesuai branch deployment Anda).
3. Memastikan domain apex (`imkksa-bandaaceh.site`) juga terdaftar dan di-redirect dengan benar ke `www.imkksa-bandaaceh.site`.
