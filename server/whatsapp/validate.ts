// Validasi & pembersihan input dari chat WhatsApp.

/** Rapikan spasi berlebih dan potong teks yang terlalu panjang. */
export function cleanInput(value: string, maxLength = 200): string {
  return (value || '').replace(/\s+/g, ' ').trim().slice(0, maxLength)
}

const HURUF = 'A-Za-z\\u00C0-\\u024F'
const NAMA_PATTERN = new RegExp(`^[${HURUF}][${HURUF} .'-]{2,99}$`)
const TEMPAT_PATTERN = new RegExp(`^[${HURUF}][${HURUF} .'-]{2,59}$`)
const ALAMAT_PATTERN = new RegExp(`^[${HURUF}0-9 .,'\\/:()#-]{5,200}$`)

/** Kembalikan pesan kesalahan, atau null bila nama valid. */
export function validateNama(value: string): string | null {
  if (!value) return 'Nama belum diisi.'
  if (value.length < 3) return 'Nama terlalu pendek, minimal 3 huruf.'
  if (value.length > 100) return 'Nama terlalu panjang, maksimal 100 huruf.'
  if (!NAMA_PATTERN.test(value)) {
    return 'Nama hanya boleh berisi huruf, spasi, titik, atau tanda hubung (tanpa angka/emoji).'
  }
  return null
}

/** Kembalikan pesan kesalahan, atau null bila alamat valid. */
export function validateAlamat(value: string): string | null {
  if (!value) return 'Alamat belum diisi.'
  if (value.length < 5) return 'Alamat terlalu pendek, minimal 5 huruf.'
  if (value.length > 200) return 'Alamat terlalu panjang, maksimal 200 huruf.'
  if (!ALAMAT_PATTERN.test(value)) {
    return 'Alamat berisi karakter yang tidak diperbolehkan.'
  }
  return null
}

/** Kembalikan pesan kesalahan, atau null bila tempat lahir valid. */
export function validateTempatLahir(value: string): string | null {
  if (value.length < 3) return 'Tempat lahir terlalu pendek, minimal 3 huruf.'
  if (value.length > 60) return 'Tempat lahir terlalu panjang, maksimal 60 huruf.'
  if (!TEMPAT_PATTERN.test(value)) {
    return 'Tempat lahir hanya boleh berisi huruf dan spasi.'
  }
  return null
}

const BULAN = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
]

/**
 * Terima "31-12-1990", "31/12/1990", atau "1990-12-31".
 * Mengembalikan format penyimpanan tabel umat (YYYY-MM-DD) atau null bila tidak valid.
 */
export function parseTanggalLahir(value: string): string | null {
  const cleaned = value.replace(/[/.]/g, '-').trim()

  const dmy = /^(\d{1,2})-(\d{1,2})-(\d{4})$/.exec(cleaned)
  const ymd = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(cleaned)

  let bagian: [string, string, string]
  if (dmy) {
    bagian = [dmy[3], dmy[2], dmy[1]]
  } else if (ymd) {
    bagian = [ymd[1], ymd[2], ymd[3]]
  } else {
    return null
  }

  const tahun = Number(bagian[0])
  const bulan = Number(bagian[1])
  const hari = Number(bagian[2])

  const sekarang = new Date()
  if (tahun < 1900 || tahun > sekarang.getFullYear()) return null
  if (bulan < 1 || bulan > 12) return null
  if (hari < 1 || hari > 31) return null

  const uji = new Date(Date.UTC(tahun, bulan - 1, hari))
  if (
    uji.getUTCFullYear() !== tahun ||
    uji.getUTCMonth() !== bulan - 1 ||
    uji.getUTCDate() !== hari
  ) {
    return null
  }

  const dd = String(hari).padStart(2, '0')
  const mm = String(bulan).padStart(2, '0')
  return `${tahun}-${mm}-${dd}`
}

/** "1990-12-31" -> "31 Desember 1990" untuk pesan ringkasan. */
export function tanggalLahirToText(value: string): string {
  const cocok = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!cocok) return value
  const tahun = Number(cocok[1])
  const bulanIndex = Number(cocok[2]) - 1
  const hari = Number(cocok[3])
  const namaBulan = BULAN[bulanIndex] ?? ''
  return `${hari} ${namaBulan} ${tahun}`.trim()
}
