# Backup Percakapan & Status Proyek (IMKKSA-MIGRATION-8AFB1C)

**Tanggal Pembaruan:** Jumat, 10 Juli 2026
**Kode Referensi:** `IMKKSA-MIGRATION-8AFB1C`
**Conversation ID:** `b9af042a-bb97-4a37-86c5-4009dc63655c` (Session Baru)

---

## 1. Status Terakhir Proyek & Langkah yang Berhasil
* **Git & GitHub Clean-Up:**
  * File credentials JSON (`website-gpib-banda-aceh-2151919521a6.json` dan `website-imkksa-banda-aceh-sekitar-2151919521a6.json`) telah **dihapus sepenuhnya** dari seluruh history commit Git lokal menggunakan `git filter-branch`.
  * Git push paksa (`git push origin master --force`) ke repository GitHub baru di akun `imkksabandaaceh@gmail.com` telah **berhasil sukses 100%** tanpa hambatan push protection.
* **Google Apps Script Baru:**
  * Konfigurasi `appsscript.json` telah diperbaiki untuk menyertakan akses publik webapp (`ANYONE_ANONYMOUS`).
  * Kode backend `Code.js` terbaru telah didorong (`clasp push`) dan dideploy sebagai Web App versi aktif (`clasp deploy`).
  * Otorisasi OAuth Google Drive untuk akun baru (`imkksabandaaceh@gmail.com`) telah disetujui oleh user via editor script (menjalankan fungsi `testGoogleDrive`).
* **Frontend React & Vercel Baru:**
  * Alamat email di footer Kop Surat formulir pendaftaran anggota ([src/App.tsx](file:///C:/Users/HP/karo/src/App.tsx#L1579)) telah diubah ke `imkksabandaaceh@gmail.com`.
  * Proyek Vercel baru berhasil di-import dari GitHub dan dideploy secara otomatis.
  * Subdomain default Vercel berhasil diubah dari `imkksa-karo-qxsq.vercel.app` menjadi **`imkksakaro.vercel.app`** dan statusnya aktif/dapat diakses.
  * Penyebaran kode berjalan secara otomatis melalui integrasi GitHub (setiap `git push` ke repositori akan memperbarui situs Vercel).

---

## 2. Masalah & Solusi yang Sedang Berjalan

### A. Pemulihan Domain Kustom (`imkksa-bandaaceh.site` di Rumahweb)
* **Masalah:** Email pendaftaran Rumahweb lama (`imkksa2006@gmail.com`) telah dihapus oleh Google sehingga user tidak dapat masuk ke panel domain Rumahweb untuk mengganti DNS Record ke Vercel baru.
* **Status Terkini:** User telah mengirimkan permohonan pemulihan akun/penggantian email ke Customer Support Rumahweb dan sedang menunggu proses estimasi 1x24 jam.
* **Panduan Tindakan:** Panduan detail mengenai pemulihan akun Rumahweb serta konfigurasi DNS setelah akses diperoleh kembali disimpan di berkas lokal: **`domain_migration_guide.md`** di folder artifacts.

### B. Pemulihan Data Google Apps Script Lama (Pending/Jika Diperlukan)
* **Masalah:** Google Apps Script yang lama telah dihapus oleh Google, sehingga data (halaman, settings, pengurus, umat, dll.) tidak dapat ditarik langsung dari cloud lama.
* **Rencana Solusi:**
  * Memanfaatkan cache lokal (`localStorage`) dari browser Chrome milik pengguna yang menyimpan key `imkksaSiteContent`.
  * Menyalin data JSON tersebut dari Console Developer Tools dan menempelkannya ke chat agar asisten dapat mempostingnya ke Apps Script baru untuk pemulihan database.

---
*Berikan kode referensi **`IMKKSA-MIGRATION-8AFB1C`** kepada asisten baru untuk meminta mereka langsung membaca file ini guna memahami konteks pengerjaan.*
