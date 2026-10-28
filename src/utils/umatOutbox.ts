// src/utils/umatOutbox.ts
// Antrean lokal (outbox) untuk pendaftaran anggota yang GAGAL terkirim ke
// Supabase. Salinannya disimpan di localStorage supaya data pendaftar tidak
// hilang saat koneksi putus / Supabase sedang bermasalah, lalu dikirim ulang
// otomatis oleh flushUmatOutbox() di App.tsx (saat halaman dibuka, saat jaringan
// kembali online, dan berkala selama antrean masih ada).
import type { UmatRecord } from '../services/umat'

const OUTBOX_KEY = 'imkksaUmatOutbox'

export interface UmatOutboxEntry {
  record: UmatRecord
  queuedAt: string
  attempts: number
  lastError?: string
}

const hasValidRecord = (value: unknown): value is UmatRecord => {
  const record = value as UmatRecord | null
  return !!record && typeof record.id === 'string' && typeof record.nama === 'string'
}

export const readUmatOutbox = (): UmatOutboxEntry[] => {
  try {
    const raw = localStorage.getItem(OUTBOX_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((entry): entry is UmatOutboxEntry =>
      !!entry && typeof entry === 'object' && hasValidRecord((entry as UmatOutboxEntry).record)
    )
  } catch (err) {
    console.error('Gagal membaca antrean pendaftaran lokal:', err)
    return []
  }
}

const writeUmatOutbox = (entries: UmatOutboxEntry[]): void => {
  try {
    if (entries.length === 0) localStorage.removeItem(OUTBOX_KEY)
    else localStorage.setItem(OUTBOX_KEY, JSON.stringify(entries))
  } catch (err) {
    // localStorage penuh / diblokir → data tetap ada di layar pengguna, tapi
    // tidak bisa diantrekan. Cukup catat, jangan sampai form ikut gagal.
    console.error('Gagal menyimpan antrean pendaftaran lokal:', err)
  }
}

export const umatOutbox = {
  /** Pendaftaran yang masih menunggu dikirim (siap di-upsert ke Supabase). */
  queued(): UmatRecord[] {
    return readUmatOutbox().map(entry => entry.record)
  },

  count(): number {
    return readUmatOutbox().length
  },

  /** Simpan pendaftaran yang gagal terkirim. Idempoten per id (tidak dobel). */
  enqueue(record: UmatRecord, error?: string): void {
    const entries = readUmatOutbox().filter(entry => entry.record.id !== record.id)
    entries.push({
      record,
      queuedAt: new Date().toISOString(),
      attempts: 1,
      ...(error ? { lastError: error } : {}),
    })
    writeUmatOutbox(entries)
  },

  /** Catat percobaan ulang yang masih gagal (untuk diagnosa di DevTools). */
  markFailed(id: string, error: string): void {
    const entries = readUmatOutbox().map(entry =>
      entry.record.id === id
        ? { ...entry, attempts: entry.attempts + 1, lastError: error }
        : entry
    )
    writeUmatOutbox(entries)
  },

  /** Hapus entri setelah berhasil terkirim ke Supabase. */
  remove(id: string): void {
    writeUmatOutbox(readUmatOutbox().filter(entry => entry.record.id !== id))
  },
}
