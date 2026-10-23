// Utilitas nomor WhatsApp.
// Nomor disimpan dalam format internasional tanpa "+", contoh: 628123456789.

/**
 * Ubah nomor apa pun (0812..., +62812..., 62812..., 812..., "62812...@c.us")
 * menjadi format 62xxxxxxxxxx. Mengembalikan '' bila tidak ada digit.
 */
export function normalizePhone(raw: string): string {
  const digits = (raw || '').replace(/\D/g, '')
  if (!digits) return ''
  if (digits.startsWith('62')) return digits
  if (digits.startsWith('0')) return `62${digits.slice(1)}`
  if (digits.startsWith('8')) return `62${digits}`
  return digits
}

/**
 * Variasi penulisan nomor yang lazim dipakai di kolom umat.no_hp
 * (data lama diisi manual, jadi formatnya campur).
 */
export function phoneVariants(waNumber: string): string[] {
  if (!waNumber) return []
  const local = waNumber.startsWith('62') ? `0${waNumber.slice(2)}` : waNumber
  return [waNumber, local, `+${waNumber}`]
}

/** Sembunyikan sebagian nomor agar log tidak memuat nomor utuh. */
export function maskPhone(waNumber: string): string {
  if (waNumber.length <= 6) return '***'
  return `${waNumber.slice(0, 4)}****${waNumber.slice(-3)}`
}
