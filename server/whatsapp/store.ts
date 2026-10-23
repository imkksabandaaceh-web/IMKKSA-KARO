// Implementasi WaStore dengan REST API Supabase (service role key, hanya di server).
//
// Kenapa fetch langsung, bukan supabase-js?
// Kunci Supabase model baru (sb_secret_...) BUKAN JWT. Dokumentasi resmi Supabase
// meminta kunci seperti ini dikirim di header `apikey` saja, bukan di
// `Authorization: Bearer`. supabase-js versi ini masih menambahkan
// `Authorization: Bearer <kunci>` secara default, dan gateway Supabase bisa
// menolaknya dengan "Invalid JWT" karena mencoba membacanya sebagai JWT.
// Karena itu semua permintaan di bawah hanya memakai `apikey`.
// Referensi:
//   https://supabase.com/docs/guides/getting-started/api-keys
//   https://supabase.com/docs/guides/getting-started/migrating-to-new-api-keys
import type { MemberMatch, NewMember, SessionData, WaSession, WaState, WaStore } from './types.js'
import { normalizePhone } from './phone.js'

const TABEL_SESI = 'wa_sessions'
const TABEL_UMAT = 'umat'
const TIMEOUT_MS = 10000

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

interface RestOptions {
  method?: 'GET' | 'POST' | 'DELETE'
  body?: unknown
  prefer?: string
}

/** Error dari REST Supabase. Tidak pernah memuat nilai kunci. */
function restError(status: number, teks: string): Error {
  const potong = teks.trim().slice(0, 300)
  return new Error(`Supabase menolak permintaan (HTTP ${status})${potong ? `: ${potong}` : ''}`)
}

/**
 * Buat store yang menulis ke Supabase.
 * SUPABASE_SERVICE_ROLE_KEY sengaja hanya dipakai di server (bukan variabel VITE_).
 * `fetchImpl` hanya dipakai skrip uji untuk mengganti fetch.
 */
export function createSupabaseStore(
  url: string,
  serviceRoleKey: string,
  fetchImpl: typeof fetch = fetch,
): WaStore {
  const base = `${url.replace(/\/+$/, '')}/rest/v1`

  async function request<T>(path: string, options: RestOptions = {}): Promise<T | null> {
    const headers: Record<string, string> = {
      // Kunci hanya di sini. Jangan tambahkan Authorization: Bearer.
      apikey: serviceRoleKey,
      Accept: 'application/json',
    }
    if (options.body !== undefined) headers['Content-Type'] = 'application/json'
    if (options.prefer) headers.Prefer = options.prefer

    const response = await fetchImpl(`${base}/${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })

    if (!response.ok) {
      const teks = await response.text().catch(() => '')
      throw restError(response.status, teks)
    }

    // 204 No Content (insert/delete dengan Prefer: return=minimal).
    if (response.status === 204) return null

    const teks = await response.text()
    if (!teks) return null
    try {
      return JSON.parse(teks) as T
    } catch {
      throw new Error('Respons Supabase bukan JSON yang valid')
    }
  }

  return {
    async getSession(waNumber: string): Promise<WaSession | null> {
      const rows = await request<SessionRow[]>(
        `${TABEL_SESI}?select=wa_number,state,data,push_name,updated_at` +
          `&wa_number=eq.${encodeURIComponent(waNumber)}&limit=1`,
      )
      const data = rows?.[0]
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
      await request(`${TABEL_SESI}?on_conflict=wa_number`, {
        method: 'POST',
        body: {
          wa_number: session.wa_number,
          state: session.state,
          data: session.data,
          push_name: session.push_name,
          updated_at: session.updated_at,
        },
        prefer: 'resolution=merge-duplicates,return=minimal',
      })
    },

    async clearSession(waNumber: string): Promise<void> {
      await request(`${TABEL_SESI}?wa_number=eq.${encodeURIComponent(waNumber)}`, {
        method: 'DELETE',
        prefer: 'return=minimal',
      })
    },

    async findByPhone(waNumber: string): Promise<MemberMatch[]> {
      // Kolom no_hp diisi manual sejak dulu (format campur: 08..., +62..., pakai
      // spasi/strip), jadi pencocokan dilakukan setelah normalisasi di sisi aplikasi.
      const data = await request<UmatRow[]>(
        `${TABEL_UMAT}?select=id,nama,no_hp&no_hp=not.is.null&limit=5000`,
      )

      return (data || [])
        .filter((row) => normalizePhone(row.no_hp || '') === waNumber)
        .map((row) => ({ id: row.id, nama: row.nama, no_hp: row.no_hp || '' }))
    },

    async insertPendingMember(member: NewMember): Promise<void> {
      await request(TABEL_UMAT, {
        method: 'POST',
        body: member,
        prefer: 'return=minimal',
      })
    },
  }
}
