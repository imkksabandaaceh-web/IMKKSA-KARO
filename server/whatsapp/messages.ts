// Semua teks balasan WhatsApp. Dipisah agar mudah diubah tanpa menyentuh logika.
import type { SessionData } from './types.ts'
import { tanggalLahirToText } from './validate.ts'

export const pesan = {
  menu(): string {
    return [
      'Halo 👋 Saya asisten pendataan anggota IMKKSA Banda Aceh Sekitar.',
      '',
      'Ketik salah satu perintah berikut:',
      '• DAFTAR — mendaftar sebagai anggota',
      '• BANTUAN — melihat panduan ini',
      '',
      'Contoh: balas dengan tulisan DAFTAR (huruf besar/kecil sama saja).',
    ].join('\n')
  },

  bantuan(): string {
    return [
      'Panduan singkat:',
      '',
      '• DAFTAR — mulai mendaftar sebagai anggota.',
      '• ULANG — tampilkan lagi pertanyaan yang sedang ditanyakan.',
      '• BATAL — batalkan proses pendaftaran.',
      '• BANTUAN — tampilkan pesan ini.',
      '',
      'Saat ditanya bagian yang tidak wajib (alamat, tempat/tanggal lahir),',
      'Anda boleh membalas LEWATI.',
      'Nomor WhatsApp ini otomatis dipakai sebagai nomor HP Anda.',
    ].join('\n')
  },

  tanyaNama(): string {
    return 'Langkah 1 dari 4 — Ketik nama lengkap Anda.\nContoh: Bunga br Sembiring'
  },

  tanyaAlamat(): string {
    return 'Langkah 2 dari 4 — Ketik alamat lengkap Anda.\nContoh: Jl. Tgk. H. M. Daud Beureueh No. 10, Banda Aceh\n(Balas LEWATI jika tidak ingin mengisi.)'
  },

  tanyaTempatLahir(): string {
    return 'Langkah 3 dari 4 — Ketik tempat lahir Anda.\nContoh: Kabanjahe\n(Balas LEWATI jika tidak ingin mengisi.)'
  },

  tanyaTanggalLahir(): string {
    return 'Langkah 4 dari 4 — Ketik tanggal lahir Anda.\nFormat: HARI-BULAN-TAHUN\nContoh: 17-08-1995\n(Balas LEWATI jika tidak ingin mengisi.)'
  },

  ringkasan(data: SessionData, waNumber: string): string {
    return [
      'Mohon periksa data berikut:',
      '',
      `Nama          : ${data.nama || '-'}`,
      `Alamat        : ${data.alamat || '-'}`,
      `Tempat lahir  : ${data.tempat_lahir || '-'}`,
      `Tanggal lahir : ${data.tanggal_lahir ? tanggalLahirToText(data.tanggal_lahir) : '-'}`,
      `No. WhatsApp  : ${waNumber}`,
      '',
      'Balas YA jika data sudah benar.',
      'Balas TIDAK untuk membatalkan.',
    ].join('\n')
  },

  sudahTerdaftar(nama: string): string {
    return [
      `Nomor WhatsApp ini sudah terdaftar atas nama: ${nama}.`,
      '',
      'Jadi tidak perlu mendaftar lagi. Jika ada data yang perlu diperbarui,',
      'silakan hubungi pengurus IMKKSA Banda Aceh.',
    ].join('\n')
  },

  berhasil(nama: string): string {
    return [
      `Terima kasih, ${nama}! 🙏`,
      '',
      'Data Anda sudah kami terima dan masuk antrean verifikasi pengurus.',
      'Setelah diverifikasi, nama Anda akan tampil di daftar anggota website IMKKSA.',
      'Nomor WhatsApp ini kami simpan sebagai kontak Anda.',
    ].join('\n')
  },

  dibatalkan(): string {
    return 'Pendaftaran dibatalkan. Data yang tadi Anda isi tidak disimpan.\nKetik DAFTAR jika ingin memulai lagi.'
  },

  belumAdaProses(): string {
    return 'Belum ada proses pendaftaran yang sedang berjalan.\nKetik DAFTAR untuk mulai mendaftar, atau BANTUAN untuk melihat panduan.'
  },

  konfirmasiTidakDikenal(): string {
    return 'Balas YA jika data sudah benar, atau TIDAK untuk membatalkan.'
  },

  salahPaham(): string {
    return 'Maaf, saya belum mengerti pesan itu.\nKetik BANTUAN untuk melihat daftar perintah.'
  },
}
