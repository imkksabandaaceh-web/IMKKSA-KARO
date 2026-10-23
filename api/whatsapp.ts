// Endpoint webhook WhatsApp (Vercel Serverless Function): POST /api/whatsapp?secret=...
//
// Alur: request -> verifikasi secret -> filter pesan -> state machine -> balas via Fonnte.
// Rahasia hanya dibaca dari environment variable, tidak pernah ditulis di kode:
//   WA_WEBHOOK_SECRET, WA_GATEWAY_TOKEN, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
import { createWhatsappHandler } from '../server/whatsapp/http.ts'
import { createSupabaseStore } from '../server/whatsapp/store.ts'
import { sendViaFonnte } from '../server/whatsapp/fonnte.ts'

const handler = createWhatsappHandler({
  getSecret: () => process.env.WA_WEBHOOK_SECRET,

  getStore: () => {
    const url = process.env.SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) {
      throw new Error('SUPABASE_URL atau SUPABASE_SERVICE_ROLE_KEY belum diset')
    }
    return createSupabaseStore(url, key)
  },

  async sendReply(target, message, inboxId) {
    const token = process.env.WA_GATEWAY_TOKEN
    if (!token) throw new Error('WA_GATEWAY_TOKEN belum diset')

    // Fonnte memakai nomor tanpa akhiran @c.us / @lid.
    const nomorTujuan = target.split('@')[0]
    await sendViaFonnte({ token, target: nomorTujuan, message, inboxId })
  },
})

export default handler
