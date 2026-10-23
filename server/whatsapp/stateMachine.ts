// State machine percakapan WhatsApp pendataan anggota.
// Fungsi ini murni soal alur + validasi; pengiriman balasan dilakukan lapisan HTTP.
import type { SessionData, WaSession, WaState, WaStore } from './types.js'
import { normalizePhone } from './phone.js'
import {
  cleanInput,
  parseTanggalLahir,
  validateAlamat,
  validateNama,
  validateTempatLahir,
} from './validate.js'
import { pesan } from './messages.js'

/** Sesi yang tidak dilanjutkan dalam 1 jam dianggap kedaluwarsa. */
export const SESSION_TTL_MS = 60 * 60 * 1000
/** Batas panjang teks yang diproses, mencegah input iseng yang sangat panjang. */
const MAX_TEXT = 500

export interface IncomingMessage {
  /** Nomor pengirim apa adanya dari gateway (bisa berakhiran @c.us). */
  sender: string
  /** Isi pesan teks. */
  text: string
  /** Nama profil WhatsApp pengirim (opsional). */
  pushName?: string
  /** URL media (foto/gambar) jika pesan berupa lampiran. */
  mediaUrl?: string
}

const YA = ['YA', 'Y', 'IYA', 'BENAR', 'OK', 'OKE']
const TIDAK = ['TIDAK', 'TDK', 'GAK', 'NO', 'N']

const pertanyaan: Record<'nama' | 'alamat' | 'tempat_lahir' | 'tanggal_lahir' | 'photo', (isAnggota?: boolean) => string> = {
  nama: (isAnggota) => pesan.tanyaNama(isAnggota),
  alamat: () => pesan.tanyaAlamat(),
  tempat_lahir: () => pesan.tanyaTempatLahir(),
  tanggal_lahir: () => pesan.tanyaTanggalLahir(),
  photo: () => pesan.tanyaFoto(),
}

function sesiBaru(waNumber: string, pushName: string | undefined, now: Date): WaSession {
  return {
    wa_number: waNumber,
    state: 'idle',
    data: {},
    push_name: pushName || null,
    updated_at: now.toISOString(),
  }
}

function sudahKedaluwarsa(session: WaSession, now: Date): boolean {
  const waktu = Date.parse(session.updated_at)
  if (Number.isNaN(waktu)) return true
  return now.getTime() - waktu > SESSION_TTL_MS
}

/**
 * Proses satu pesan masuk dan kembalikan teks balasan.
 * null berarti tidak perlu membalas apa pun.
 */
export async function handleIncoming(
  input: IncomingMessage,
  store: WaStore,
  now: Date = new Date(),
): Promise<string | null> {
  const waNumber = normalizePhone(input.sender)
  if (!waNumber) return null

  const text = cleanInput(input.text, MAX_TEXT)
  // Jika tidak ada teks tetapi ada media foto, gunakan tanda foto
  if (!text && !input.mediaUrl) return null
  const perintah = text ? text.toUpperCase() : ''

  let session = await store.getSession(waNumber)
  if (session && sudahKedaluwarsa(session, now)) {
    await store.clearSession(waNumber)
    session = null
  }

  if (perintah === 'BATAL') {
    if (!session || session.state === 'idle') {
      await store.clearSession(waNumber)
      return pesan.belumAdaProses()
    }
    await store.clearSession(waNumber)
    return pesan.dibatalkan()
  }

  if (perintah === 'BANTUAN' || perintah === 'HELP' || perintah === 'MENU') {
    return pesan.bantuan()
  }

  if (session?.state === 'tanya_tambah') {
    if (perintah === 'TAMBAH' || YA.includes(perintah) || perintah === 'DAFTAR') {
      session.state = 'nama'
      session.data = {}
      session.updated_at = now.toISOString()
      await store.saveSession(session)
      return pesan.tanyaNama(true)
    }
    if (perintah === 'BATAL' || TIDAK.includes(perintah)) {
      await store.clearSession(waNumber)
      return pesan.dibatalkan()
    }
    const cocok = await store.findByPhone(waNumber)
    return pesan.sudahTerdaftarDenganOpsi(cocok.map((c) => c.nama))
  }

  if (session?.state === 'selesai_tambah') {
    if (perintah === 'TAMBAH' || YA.includes(perintah) || perintah === 'DAFTAR') {
      session.state = 'nama'
      session.data = {}
      session.updated_at = now.toISOString()
      await store.saveSession(session)
      return pesan.tanyaNama(true)
    }
    if (perintah === 'SELESAI' || TIDAK.includes(perintah) || perintah === 'BATAL') {
      await store.clearSession(waNumber)
      return pesan.selesaiKeluarga()
    }
    return 'Ketik TAMBAH untuk mendaftarkan anggota keluarga baru, atau ketik SELESAI jika sudah cukup.'
  }

  if (perintah === 'DAFTAR' || perintah === 'TAMBAH') {
    return mulaiPendaftaran(waNumber, input.pushName, store, now)
  }

  if (!session || session.state === 'idle') {
    if (perintah === 'ULANG') return pesan.belumAdaProses()
    return pesan.menu()
  }

  if (perintah === 'ULANG') {
    if (session.state === 'konfirmasi') return pesan.ringkasan(session.data, waNumber)
    if (session.state === 'photo') return pesan.tanyaFoto()
    return pertanyaan[session.state]()
  }

  return lanjutkanPercakapan(session, input, text, perintah, waNumber, store, now)
}

async function mulaiPendaftaran(
  waNumber: string,
  pushName: string | undefined,
  store: WaStore,
  now: Date,
): Promise<string> {
  const cocok = await store.findByPhone(waNumber)
  if (cocok.length > 0) {
    const sesi = sesiBaru(waNumber, pushName, now)
    sesi.state = 'tanya_tambah'
    await store.saveSession(sesi)
    return pesan.sudahTerdaftarDenganOpsi(cocok.map((c) => c.nama))
  }

  const sesi = sesiBaru(waNumber, pushName, now)
  sesi.state = 'nama'
  await store.saveSession(sesi)
  return pesan.tanyaNama(false)
}

async function lanjutkanPercakapan(
  session: WaSession,
  input: IncomingMessage,
  text: string,
  perintah: string,
  waNumber: string,
  store: WaStore,
  now: Date,
): Promise<string> {
  const lewati = perintah === 'LEWATI' || perintah === 'SKIP' || perintah === '-'

  switch (session.state) {
    case 'nama': {
      const nama = text
      const salah = validateNama(nama)
      if (salah) return `${salah}\n\n${pesan.tanyaNama()}`
      return simpanDanTanya(session, { nama }, 'alamat', store, now)
    }

    case 'alamat': {
      const alamat = lewati ? '' : text
      if (!lewati) {
        const salah = validateAlamat(alamat)
        if (salah) return `${salah}\n\n${pesan.tanyaAlamat()}`
      }
      return simpanDanTanya(session, { alamat }, 'tempat_lahir', store, now)
    }

    case 'tempat_lahir': {
      const tempat = lewati ? '' : text
      if (!lewati) {
        const salah = validateTempatLahir(tempat)
        if (salah) return `${salah}\n\n${pesan.tanyaTempatLahir()}`
      }
      return simpanDanTanya(session, { tempat_lahir: tempat }, 'tanggal_lahir', store, now)
    }

    case 'tanggal_lahir': {
      if (lewati) {
        return simpanDanTanya(session, { tanggal_lahir: '' }, 'photo', store, now)
      }
      const tanggal = parseTanggalLahir(text)
      if (!tanggal) {
        return `Tanggal tidak dikenali. Gunakan format HARI-BULAN-TAHUN, contoh: 17-08-1995.\n\n${pesan.tanyaTanggalLahir()}`
      }
      return simpanDanTanya(session, { tanggal_lahir: tanggal }, 'photo', store, now)
    }

    case 'photo': {
      if (lewati) {
        const terbaru = await simpanSesi(session, { photo: '' }, 'konfirmasi', store, now)
        return pesan.ringkasan(terbaru.data, waNumber)
      }
      if (input.mediaUrl) {
        const terbaru = await simpanSesi(session, { photo: input.mediaUrl }, 'konfirmasi', store, now)
        return pesan.ringkasan(terbaru.data, waNumber)
      }
      return `Kirimkan foto langsung di chat ini, atau balas LEWATI jika tidak ingin mengunggah foto sekarang.\n\n${pesan.tanyaFoto()}`
    }

    case 'konfirmasi': {
      if (TIDAK.includes(perintah)) {
        await store.clearSession(waNumber)
        return pesan.dibatalkan()
      }
      if (!YA.includes(perintah)) {
        return pesan.konfirmasiTidakDikenal()
      }
      return simpanAnggota(session, waNumber, store, now)
    }

    case 'idle':
    default:
      return pesan.menu()
  }
}

async function simpanSesi(
  session: WaSession,
  tambahan: SessionData,
  state: WaState,
  store: WaStore,
  now: Date,
): Promise<WaSession> {
  const terbaru: WaSession = {
    ...session,
    state,
    data: { ...session.data, ...tambahan },
    updated_at: now.toISOString(),
  }
  await store.saveSession(terbaru)
  return terbaru
}

async function simpanDanTanya(
  session: WaSession,
  tambahan: SessionData,
  state: 'alamat' | 'tempat_lahir' | 'tanggal_lahir' | 'photo',
  store: WaStore,
  now: Date,
): Promise<string> {
  await simpanSesi(session, tambahan, state, store, now)
  return pertanyaan[state]()
}

async function simpanAnggota(
  session: WaSession,
  waNumber: string,
  store: WaStore,
  now: Date,
): Promise<string> {
  const data = session.data
  if (!data.nama) {
    await store.clearSession(waNumber)
    return `Data nama tidak ditemukan, silakan mulai lagi.\n\n${pesan.tanyaNama()}`
  }

  // Cek apakah nama yang sama persis sudah pernah didaftarkan dari nomor ini
  const cocok = await store.findByPhone(waNumber)
  const namaSama = cocok.find(
    (c) => c.nama.trim().toLowerCase() === data.nama?.trim().toLowerCase(),
  )
  if (namaSama) {
    await store.clearSession(waNumber)
    return `Anggota atas nama "${namaSama.nama}" sudah terdaftar sebelumnya dengan nomor ini.\nKetik DAFTAR untuk mendaftarkan anggota keluarga lainnya.`
  }

  try {
    await store.insertPendingMember({
      id: `pending_${Date.now()}`,
      nama: data.nama,
      status: 'Anggota',
      alamat: data.alamat || '',
      no_hp: waNumber,
      photo: data.photo || '',
      kk: '',
      is_pending: true,
      tempat_lahir: data.tempat_lahir || '',
      tanggal_lahir: data.tanggal_lahir || '',
    })
  } catch {
    return 'Maaf, data gagal disimpan karena gangguan sementara. Silakan balas YA sekali lagi beberapa saat kemudian, atau hubungi pengurus IMKKSA.'
  }

  // Set state ke 'selesai_tambah' agar umat bisa langsung mengetik TAMBAH untuk anak/keluarga berikutnya
  const sesiBerikutnya: WaSession = {
    wa_number: waNumber,
    state: 'selesai_tambah',
    data: {},
    push_name: session.push_name,
    updated_at: now.toISOString(),
  }
  await store.saveSession(sesiBerikutnya)
  return pesan.berhasil(data.nama)
}
