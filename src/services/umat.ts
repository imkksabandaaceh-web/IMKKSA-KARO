// src/services/umat.ts
// Layanan baca/tulis data anggota (umat) langsung ke tabel `public.umat` di Supabase.
// Menggantikan penyimpanan via Google Apps Script (Script Properties, batas 500 KB)
// sehingga aman untuk ratusan keluarga dan pencarian tetap cepat.
import { supabase } from './supabase'

export interface UmatRecord {
  id: string
  nama: string
  status: string
  nik: string
  alamat: string
  noHp: string
  photo: string
  kk: string
  isPending?: boolean
  tempatLahir?: string
  tanggalLahir?: string
}

// Bentuk baris di tabel public.umat.
// Kolom selain id/nama/is_pending dibuat opsional karena query publik
// (fetchApproved) tidak memilih kolom sensitif NIK & KK.
interface UmatRow {
  id: string
  nama: string
  is_pending: boolean
  status?: string | null
  nik?: string | null
  alamat?: string | null
  no_hp?: string | null
  photo?: string | null
  kk?: string | null
  tempat_lahir?: string | null
  tanggal_lahir?: string | null
}

// Mapping: baris DB (snake_case) → bentuk yang dipakai aplikasi (camelCase)
const toApp = (row: UmatRow): UmatRecord => ({
  id: row.id,
  nama: row.nama,
  status: row.status || 'Anggota',
  nik: row.nik || '',
  alamat: row.alamat || '',
  noHp: row.no_hp || '',
  photo: row.photo || '',
  kk: row.kk || '',
  isPending: row.is_pending,
  tempatLahir: row.tempat_lahir || '',
  tanggalLahir: row.tanggal_lahir || '',
})

// Mapping: bentuk aplikasi (camelCase) → baris DB (snake_case)
const toDb = (u: UmatRecord) => ({
  id: u.id,
  nama: u.nama,
  status: u.status,
  nik: u.nik,
  alamat: u.alamat,
  no_hp: u.noHp,
  photo: u.photo,
  kk: u.kk,
  is_pending: !!u.isPending,
  tempat_lahir: u.tempatLahir || '',
  tanggal_lahir: u.tanggalLahir || '',
})

// Kolom yang aman untuk publik (TANPA NIK & KK yang bersifat privat)
const PUBLIC_COLS = 'id,nama,status,alamat,no_hp,photo,tempat_lahir,tanggal_lahir,is_pending,created_at'
// Kolom lengkap (khusus admin yang sudah login)
const ALL_COLS = 'id,nama,status,nik,alamat,no_hp,photo,kk,tempat_lahir,tanggal_lahir,is_pending,created_at'

export const umatService = {
  /**
   * Publik: hanya anggota yang sudah disetujui (is_pending = false),
   * tanpa kolom sensitif (NIK, KK). Mendukung pencarian nama via ilike.
   */
  async fetchApproved(search = ''): Promise<UmatRecord[]> {
    let query = supabase
      .from('umat')
      .select(PUBLIC_COLS)
      .eq('is_pending', false)
      .order('nama')

    const trimmed = search.trim()
    if (trimmed) {
      query = query.ilike('nama', `%${trimmed}%`)
    }

    const { data, error } = await query
    if (error) throw error
    return (data || []).map(toApp)
  },

  /**
   * Admin (perlu sesi login Supabase): semua baris, termasuk pending, NIK, KK.
   * RLS hanya mengizinkan role authenticated membaca/menulis penuh.
   */
  async fetchAll(): Promise<UmatRecord[]> {
    const { data, error } = await supabase
      .from('umat')
      .select(ALL_COLS)
      .order('created_at', { ascending: false })
    if (error) throw error
    return (data || []).map(toApp)
  },

  /** Sisipkan/perbarui (upsert) satu atau banyak anggota berdasarkan kolom id. */
  async upsert(list: UmatRecord[]): Promise<void> {
    if (!list || list.length === 0) return
    const { error } = await supabase
      .from('umat')
      .upsert(list.map(toDb), { onConflict: 'id' })
    if (error) throw error
  },

  /** Hapus satu anggota berdasarkan id. */
  async remove(id: string): Promise<void> {
    const { error } = await supabase
      .from('umat')
      .delete()
      .eq('id', id)
    if (error) throw error
  },
}
