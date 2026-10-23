// Semua teks balasan WhatsApp. Dipisah agar mudah diubah tanpa menyentuh logika.
import type { SessionData } from './types.js'
import { tanggalLahirToText } from './validate.js'

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

  tanyaNama(isAnggotaKeluarga = false): string {
    const judul = isAnggotaKeluarga ? 'anggota keluarga (anak/pasangan)' : 'Anda'
    return `Langkah 1 dari 5 — Ketik nama lengkap ${judul}.\nContoh: Bunga br Sembiring`
  },

  tanyaAlamat(): string {
    return 'Langkah 2 dari 5 — Ketik alamat lengkap.\nContoh: Jl. Tgk. H. M. Daud Beureueh No. 10, Banda Aceh\n(Balas LEWATI jika tidak ingin mengisi.)'
  },

  tanyaTempatLahir(): string {
    return 'Langkah 3 dari 5 — Ketik tempat lahir.\nContoh: Kabanjahe\n(Balas LEWATI jika tidak ingin mengisi.)'
  },

  tanyaTanggalLahir(): string {
    return 'Langkah 4 dari 5 — Ketik tanggal lahir.\nFormat: HARI-BULAN-TAHUN\nContoh: 17-08-1995\n(Balas LEWATI jika tidak ingin mengisi.)'
  },

  tanyaFoto(): string {
    return 'Langkah 5 dari 5 — Kirimkan 1 lembar pas foto.\n(Kirim foto langsung di chat ini, atau balas LEWATI jika tidak ingin mengunggah foto sekarang.)'
  },

  ringkasan(data: SessionData, waNumber: string): string {
    return [
      'Mohon periksa data berikut:',
      '',
      `Nama          : ${data.nama || '-'}`,
      `Alamat        : ${data.alamat || '-'}`,
      `Tempat lahir  : ${data.tempat_lahir || '-'}`,
      `Tanggal lahir : ${data.tanggal_lahir ? tanggalLahirToText(data.tanggal_lahir) : '-'}`,
      `Pas Foto      : ${data.photo ? 'Ada (1 foto terlampir)' : '-'}`,
      `No. Kontak/WA : ${waNumber}`,
      '',
      'Balas YA jika data sudah benar.',
      'Balas TIDAK untuk membatalkan.',
    ].join('\n')
  },

  sudahTerdaftar(nama: string): string {
    return [
      `Nomor WhatsApp ini sudah terdaftar atas nama: ${nama}.`,
      '',
      'Apakah Anda ingin mendaftarkan anggota keluarga lain (anak/pasangan yang tidak memiliki HP)?',
      '',
      'Ketik salah satu perintah berikut:',
      '• TAMBAH — mendaftar anggota keluarga baru',
      '• BATAL — jika tidak jadi',
    ].join('\n')
  },

  sudahTerdaftarDenganOpsi(daftarNama: string[]): string {
    const list = daftarNama.map((nama) => `• ${nama}`).join('\n')
    return [
      'Nomor WhatsApp ini sudah terdaftar atas nama:',
      list,
      '',
      'Apakah Anda ingin mendaftarkan anggota keluarga lain (anak/pasangan yang belum memiliki HP)?',
      '',
      'Ketik salah satu pilihan berikut:',
      '• TAMBAH — mendaftarkan anggota keluarga baru',
      '• BATAL — jika tidak jadi',
    ].join('\n')
  },

  berhasil(nama: string): string {
    return [
      `Terima kasih, data atas nama ${nama} sudah kami terima! 🙏`,
      '',
      'Data sudah masuk ke antrean verifikasi pengurus IMKKSA.',
      'Nomor WhatsApp ini disimpan sebagai nomor kontak keluarga.',
      '',
      'Apakah Anda ingin mendaftarkan anggota keluarga lain (anak/pasangan)?',
      '• Balas TAMBAH untuk mendaftarkan anggota keluarga lagi',
      '• Balas SELESAI jika pendaftaran sudah cukup',
    ].join('\n')
  },

  selesaiKeluarga(): string {
    return [
      'Pendaftaran anggota keluarga selesai. Terima kasih banyak atas partisipasinya! 🙏',
      'Semua data akan diverifikasi oleh pengurus IMKKSA.',
      'Ketik DAFTAR kapan saja jika ingin mendaftarkan anggota keluarga lainnya.',
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
