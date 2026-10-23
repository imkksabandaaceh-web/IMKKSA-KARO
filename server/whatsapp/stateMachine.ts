// State machine percakapan WhatsApp pendataan anggota.
// Fungsi ini murni soal alur + validasi; pengiriman balasan dilakukan lapisan HTTP.
import type { SessionData, WaSession, WaState, WaStore } from './types.ts'
import { normalizePhone } from './phone.ts'
import {
  cleanInput,
  parseTanggalLahir,
  validateAlamat,
  validateNama,
  validateTempatLahir,
} from './validate.ts'
import { pesan } from './messages.ts'

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
}

const YA = ['YA', 'Y', 'IYA', 'BENAR', 'OK', 'OKE']
const TIDAK = ['TIDAK', 'TDK', 'GAK', 'NO', 'N']

const pertanyaan: Record<'nama' | 'alamat' | 'tempat_lahir' | 'tanggal_lahir', () => string> = {
  nama: () => pesan.tanyaNama(),
  alamat: () => pesan.tanyaAlamat(),
  tempat_lahir: () => pesan.tanyaTempatLahir(),
  tanggal_lahir: () => pesan.tanyaTanggalLahir(),
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
  if (!text) return null
  const perintah = text.toUpperCase()

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

  if (perintah === 'DAFTAR') {
    return mulaiPendaftaran(waNumber, input.pushName, store, now)
  }

  if (!session || session.state === 'idle') {
    if (perintah === 'ULANG') return pesan.belumAdaProses()
    return pesan.menu()
  }

  if (perintah === 'ULANG') {
    if (session.state === 'konfirmasi') return pesan.ringkasan(session.data, waNumber)
    return pertanyaan[session.state]()
  }

  return lanjutkanPercakapan(session, text, perintah, waNumber, store, now)
}

async function mulaiPendaftaran(
  waNumber: string,
  pushName: string | undefined,
  store: WaStore,
  now: Date,
): Promise<string> {
  const cocok = await store.findByPhone(waNumber)
  if (cocok.length > 0) {
    return pesan.sudahTerdaftar(cocok[0].nama)
  }

  const sesi = sesiBaru(waNumber, pushName, now)
  sesi.state = 'nama'
  await store.saveSession(sesi)
  return pesan.tanyaNama()
}

async function lanjutkanPercakapan(
  session: WaSession,
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
        const terbaru = await simpanSesi(session, { tanggal_lahir: '' }, 'konfirmasi', store, now)
        return pesan.ringkasan(terbaru.data, waNumber)
      }
      const tanggal = parseTanggalLahir(text)
      if (!tanggal) {
        return `Tanggal tidak dikenali. Gunakan format HARI-BULAN-TAHUN, contoh: 17-08-1995.\n\n${pesan.tanyaTanggalLahir()}`
      }
      const terbaru = await simpanSesi(session, { tanggal_lahir: tanggal }, 'konfirmasi', store, now)
      return pesan.ringkasan(terbaru.data, waNumber)
    }

    case 'konfirmasi': {
      if (TIDAK.includes(perintah)) {
        await store.clearSession(waNumber)
        return pesan.dibatalkan()
      }
      if (!YA.includes(perintah)) {
        return pesan.konfirmasiTidakDikenal()
      }
      return simpanAnggota(session, waNumber, store)
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
  state: 'alamat' | 'tempat_lahir' | 'tanggal_lahir',
  store: WaStore,
  now: Date,
): Promise<string> {
  await simpanSesi(session, tambahan, state, store, now)
  return pertanyaan[state]()
}

async function simpanAnggota(session: WaSession, waNumber: string, store: WaStore): Promise<string> {
  const data = session.data
  if (!data.nama) {
    await store.clearSession(waNumber)
    return `Data nama tidak ditemukan, silakan mulai lagi.\n\n${pesan.tanyaNama()}`
  }

  // Cek ulang tepat sebelum menyimpan, untuk berjaga bila ada pesan ganda.
  const cocok = await store.findByPhone(waNumber)
  if (cocok.length > 0) {
    await store.clearSession(waNumber)
    return pesan.sudahTerdaftar(cocok[0].nama)
  }

  try {
    await store.insertPendingMember({
      id: `pending_${Date.now()}`,
      nama: data.nama,
      status: 'Anggota',
      alamat: data.alamat || '',
      no_hp: waNumber,
      photo: '',
      kk: '',
      is_pending: true,
      tempat_lahir: data.tempat_lahir || '',
      tanggal_lahir: data.tanggal_lahir || '',
    })
  } catch {
    return 'Maaf, data gagal disimpan karena gangguan sementara. Silakan balas YA sekali lagi beberapa saat kemudian, atau hubungi pengurus IMKKSA.'
  }

  await store.clearSession(waNumber)
  return pesan.berhasil(data.nama)
}
