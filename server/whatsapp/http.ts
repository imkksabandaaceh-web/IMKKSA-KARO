// Lapisan HTTP webhook WhatsApp: verifikasi secret, buang pesan yang tidak perlu,
// lalu teruskan teks ke state machine dan kirim balasan lewat gateway.
import { timingSafeEqual } from 'node:crypto'
import type { WaStore } from './types.js'
import { maskPhone, normalizePhone } from './phone.js'
import { handleIncoming } from './stateMachine.js'

export interface WaHttpRequest {
  method?: string
  query?: Record<string, string | string[] | undefined>
  headers?: Record<string, string | string[] | undefined>
  body?: unknown
}

export interface WaHttpResponse {
  status(code: number): WaHttpResponse
  json(payload: unknown): unknown
}

export type WaHttpHandler = (req: WaHttpRequest, res: WaHttpResponse) => Promise<void>

export interface WhatsappHandlerOptions {
  /** Diambil dari WA_WEBHOOK_SECRET setiap request. */
  getSecret: () => string | undefined
  /** Store dibuat per request agar env Vercel sudah tersedia. */
  getStore: () => WaStore
  /** Kirim balasan lewat Fonnte. inboxId opsional dari webhook. */
  sendReply: (target: string, message: string, inboxId?: string | number | null) => Promise<void>
  log?: (message: string, detail?: unknown) => void
}

interface FonntePayload {
  sender?: unknown
  message?: unknown
  text?: unknown
  member?: unknown
  name?: unknown
  device?: unknown
  inboxid?: unknown
}

const defaultLog = (message: string, detail?: unknown) => {
  if (detail === undefined) console.log(message)
  else console.log(message, detail)
}

function ambilString(value: unknown): string {
  if (typeof value === 'string') return value
  if (typeof value === 'number') return String(value)
  return ''
}

function ambilSatu(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] || ''
  return value || ''
}

/** Ambil secret dari ?secret=... atau header x-webhook-secret. */
function ambilSecret(req: WaHttpRequest): string {
  const dariQuery = ambilSatu(req.query?.secret)
  if (dariQuery) return dariQuery
  const dariHeader = ambilSatu(req.headers?.['x-webhook-secret'])
  if (dariHeader) return dariHeader
  const dariHeaderKapital = ambilSatu(req.headers?.['X-Webhook-Secret'])
  return dariHeaderKapital
}

function secretCocok(provided: string, expected: string): boolean {
  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

/** Body Fonnte biasanya JSON; URL-encoded/form-data juga diterima. */
function parseBody(body: unknown): FonntePayload {
  if (!body) return {}
  if (typeof body === 'object' && !Array.isArray(body)) return body as FonntePayload
  if (typeof body !== 'string') return {}

  const teks = body.trim()
  if (!teks) return {}

  if (teks.startsWith('{')) {
    try {
      return JSON.parse(teks) as FonntePayload
    } catch {
      return {}
    }
  }

  const params = new URLSearchParams(teks)
  const hasil: Record<string, string> = {}
  params.forEach((value, key) => {
    hasil[key] = value
  })
  return hasil
}

export function createWhatsappHandler(options: WhatsappHandlerOptions): WaHttpHandler {
  const log = options.log ?? defaultLog

  return async function whatsappHandler(req, res): Promise<void> {
    if (req.method && req.method.toUpperCase() !== 'POST') {
      res.status(405).json({ ok: false, error: 'method not allowed' })
      return
    }

    const expected = (options.getSecret() || '').trim()
    if (!expected) {
      log('[wa] WA_WEBHOOK_SECRET belum diset — webhook menolak semua permintaan')
      res.status(500).json({ ok: false, error: 'server belum dikonfigurasi' })
      return
    }

    const provided = ambilSecret(req).trim()
    if (!provided || !secretCocok(provided, expected)) {
      log('[wa] secret webhook salah atau kosong — permintaan ditolak')
      res.status(401).json({ ok: false, error: 'unauthorized' })
      return
    }

    const payload = parseBody(req.body)
    const sender = ambilString(payload.sender)
    const device = ambilString(payload.device)

    if (!sender) {
      res.status(200).json({ ok: true, ignored: 'tanpa-pengirim' })
      return
    }

    // Pesan grup: id grup berakhiran @g.us dan/atau ada field member.
    if (sender.includes('@g.us') || ambilString(payload.member)) {
      res.status(200).json({ ok: true, ignored: 'pesan-grup' })
      return
    }

    // Pesan dari perangkat bot sendiri (mis. sinkronisasi atau pesan keluar).
    const nomorPengirim = normalizePhone(sender)
    if (device && nomorPengirim && nomorPengirim === normalizePhone(device)) {
      res.status(200).json({ ok: true, ignored: 'nomor-bot-sendiri' })
      return
    }

    const teksPesan = ambilString(payload.message) || ambilString(payload.text)
    if (!teksPesan.trim()) {
      res.status(200).json({ ok: true, ignored: 'tanpa-teks' })
      return
    }

    const inboxId = ambilString(payload.inboxid)

    try {
      const store = options.getStore()
      const balasan = await handleIncoming(
        {
          sender,
          text: teksPesan,
          pushName: ambilString(payload.name) || undefined,
        },
        store,
      )

      if (balasan) {
        await options.sendReply(sender, balasan, inboxId || null)
      }

      log('[wa] pesan diproses', {
        dari: maskPhone(nomorPengirim),
        dibalas: Boolean(balasan),
      })
      res.status(200).json({ ok: true, replied: Boolean(balasan) })
    } catch (error) {
      const pesanError = error instanceof Error ? error.message : String(error)
      log('[wa] gagal memproses pesan', { dari: maskPhone(nomorPengirim), error: pesanError })
      res.status(500).json({ ok: false, error: 'gagal memproses pesan' })
    }
  }
}
