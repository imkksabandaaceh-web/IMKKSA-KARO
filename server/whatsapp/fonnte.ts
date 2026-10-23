// Adapter gateway Fonnte.
// Referensi resmi: https://docs.fonnte.com/api-send-message/
//   POST https://api.fonnte.com/send
//   Header: Authorization: <TOKEN>   (tanpa kata "Bearer")
//   Body form-urlencoded: target, message, inboxid (opsional), countryCode (opsional)
// Respons sukses: { status: true, detail: "success! message in queue", ... }
// Respons gagal : { status: false, reason: "..." }

const FONNTE_ENDPOINT = 'https://api.fonnte.com/send'
const TIMEOUT_MS = 10000

export interface SendMessageOptions {
  /** Isi WA_GATEWAY_TOKEN. Jangan pernah di-log. */
  token: string
  /** Nomor tujuan, format 62xxxxxxxxxx. */
  target: string
  message: string
  /** inboxid dari webhook, dipakai Fonnte agar balasan menempel pada chat masuk. */
  inboxId?: string | number | null
  /** Dipakai skrip uji untuk mengganti fetch. */
  fetchImpl?: typeof fetch
}

interface FonnteResponse {
  status?: boolean
  detail?: string
  reason?: string
}

/** Kirim satu pesan WhatsApp. Melempar Error bila gateway menolak. */
export async function sendViaFonnte(options: SendMessageOptions): Promise<void> {
  const { token, target, message, inboxId, fetchImpl } = options

  if (!token) throw new Error('WA_GATEWAY_TOKEN belum diset')
  if (!target) throw new Error('Nomor tujuan kosong')

  const body = new URLSearchParams()
  body.set('target', target)
  body.set('message', message)
  if (inboxId != null && String(inboxId) !== '' && String(inboxId) !== '0') {
    body.set('inboxid', String(inboxId))
  }

  const doFetch = fetchImpl ?? fetch
  const response = await doFetch(FONNTE_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: token,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })

  let payload: FonnteResponse
  try {
    payload = (await response.json()) as FonnteResponse
  } catch {
    payload = {}
  }

  if (!response.ok || payload.status === false) {
    const alasan = payload.reason || payload.detail || `HTTP ${response.status}`
    throw new Error(`Fonnte menolak pesan: ${alasan}`)
  }
}
