// Tipe bersama untuk fitur WhatsApp pendataan anggota.
// Semua tipe di sini "type-only", tidak ada kode yang dijalankan.

/** Langkah percakapan yang mungkin terjadi pada satu nomor WhatsApp. */
export type WaState =
  | 'idle'
  | 'tanya_tambah'
  | 'nama'
  | 'alamat'
  | 'tempat_lahir'
  | 'tanggal_lahir'
  | 'photo'
  | 'konfirmasi'
  | 'selesai_tambah'

/** Data sementara yang dikumpulkan selama percakapan (belum masuk tabel umat). */
export interface SessionData {
  nama?: string
  alamat?: string
  tempat_lahir?: string
  tanggal_lahir?: string
  photo?: string
}

/** Satu baris tabel public.wa_sessions. */
export interface WaSession {
  wa_number: string
  state: WaState
  data: SessionData
  push_name: string | null
  updated_at: string
}

/** Anggota yang sudah ada di tabel public.umat dan cocok dengan nomor pengirim. */
export interface MemberMatch {
  id: string
  nama: string
  no_hp: string
}

/** Data anggota baru yang akan disimpan sebagai baris "pending" di public.umat. */
export interface NewMember {
  id: string
  nama: string
  status: string
  alamat: string
  no_hp: string
  photo: string
  kk: string
  is_pending: boolean
  tempat_lahir: string
  tanggal_lahir: string
}

/**
 * Kontrak penyimpanan. Implementasi produksi memakai Supabase (store.ts),
 * sedangkan skrip uji lokal memakai versi in-memory.
 */
export interface WaStore {
  getSession(waNumber: string): Promise<WaSession | null>
  saveSession(session: WaSession): Promise<void>
  clearSession(waNumber: string): Promise<void>
  /** Cari anggota di tabel umat yang nomor HP-nya sama dengan nomor pengirim. */
  findByPhone(waNumber: string): Promise<MemberMatch[]>
  insertPendingMember(member: NewMember): Promise<void>
}
