// Implementasi WaStore dengan Supabase (service role key, hanya di server).
import { createClient } from '@supabase/supabase-js'
import type { MemberMatch, NewMember, SessionData, WaSession, WaState, WaStore } from './types.ts'
import { normalizePhone } from './phone.ts'

const TABEL_SESI = 'wa_sessions'
const TABEL_UMAT = 'umat'

interface SessionRow {
  wa_number: string
  state: string
  data: SessionData | null
  push_name: string | null
  updated_at: string
}

interface UmatRow {
  id: string
  nama: string
  no_hp: string | null
}

/**
 * Buat store yang menulis ke Supabase.
 * SUPABASE_SERVICE_ROLE_KEY sengaja hanya dipakai di server (bukan variabel VITE_).
 */
export function createSupabaseStore(url: string, serviceRoleKey: string): WaStore {
  const supabase = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  return {
    async getSession(waNumber: string): Promise<WaSession | null> {
      const { data, error } = await supabase
        .from(TABEL_SESI)
        .select('wa_number,state,data,push_name,updated_at')
        .eq('wa_number', waNumber)
        .maybeSingle<SessionRow>()
      if (error) throw error
      if (!data) return null
      return {
        wa_number: data.wa_number,
        state: (data.state || 'idle') as WaState,
        data: data.data || {},
        push_name: data.push_name,
        updated_at: data.updated_at,
      }
    },

    async saveSession(session: WaSession): Promise<void> {
      const { error } = await supabase.from(TABEL_SESI).upsert(
        {
          wa_number: session.wa_number,
          state: session.state,
          data: session.data,
          push_name: session.push_name,
          updated_at: session.updated_at,
        },
        { onConflict: 'wa_number' },
      )
      if (error) throw error
    },

    async clearSession(waNumber: string): Promise<void> {
      const { error } = await supabase.from(TABEL_SESI).delete().eq('wa_number', waNumber)
      if (error) throw error
    },

    async findByPhone(waNumber: string): Promise<MemberMatch[]> {
      // Kolom no_hp diisi manual sejak dulu (format campur: 08..., +62..., pakai
      // spasi/strip), jadi pencocokan dilakukan setelah normalisasi di sisi aplikasi.
      const { data, error } = await supabase
        .from(TABEL_UMAT)
        .select('id,nama,no_hp')
        .not('no_hp', 'is', null)
        .limit(5000)
      if (error) throw error

      const kandidat = ((data || []) as UmatRow[])
      return kandidat
        .filter((row) => normalizePhone(row.no_hp || '') === waNumber)
        .map((row) => ({ id: row.id, nama: row.nama, no_hp: row.no_hp || '' }))
    },

    async insertPendingMember(member: NewMember): Promise<void> {
      const { error } = await supabase.from(TABEL_UMAT).insert(member)
      if (error) throw error
    },
  }
}
