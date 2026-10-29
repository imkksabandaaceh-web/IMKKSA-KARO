# Hasil Kerja Hari Ini

- Memperbaiki keterbacaan formulir `/daftar` dengan meningkatkan kontras pertanyaan, teks bantuan, placeholder, isian, dan ringkasan data.
- Memperjelas tombol navigasi: tombol utama menggunakan hijau tua dengan teks putih agar tetap terbaca meskipun tema situs menggunakan aksen kuning terang; tombol kembali juga memiliki kontras yang jelas.
- Memperjelas tombol tutup modal serta teks dan kontrol di bagian daftar anggota.
- Verifikasi: `npm run build` berhasil, termasuk pemeriksaan kontrak RLS untuk pendaftaran.
- Menghapus dependensi Fontkit yang tidak diperlukan dari generator PDF proposal; ukuran chunk `pdfUtils` turun dari 1.134 kB (506 kB gzip) menjadi 422 kB (176 kB gzip), sehingga peringatan chunk di atas 500 kB hilang.
- Verifikasi: `npm run build` dan uji pembuatan PDF proposal 7 halaman berhasil tanpa Fontkit.
- Commit `51b5faf` (`perf: reduce proposal PDF bundle size`) sudah di-push ke `origin/master`; branch bersih dan tersinkron.
- Form pas foto kini meminta izin kamera browser secara langsung (`getUserMedia`), menampilkan pratinjau, mengambil foto lalu memakai alur kompresi/unggah yang sama; stream kamera dihentikan saat foto diambil, modal ditutup, atau komponen dilepas. Pilihan galeri tetap tersedia.
- Verifikasi kamera: build dan pemeriksaan RLS berhasil. Uji kamera fisik/browser perlu dilakukan di situs HTTPS dengan izin kamera perangkat.
