// Uji lokal webhook WhatsApp tanpa WhatsApp sungguhan dan tanpa Supabase.
//
// Cara pakai:  npm run wa:test
//
// Skrip ini:
//   1. Menyalakan server HTTP lokal yang memakai handler asli (server/whatsapp/http.ts).
//   2. Mengganti store Supabase dengan store in-memory.
//   3. Mengganti pengiriman Fonnte dengan fetch palsu, lalu memeriksa
//      URL, header Authorization, dan isi body yang akan dikirim.
// Semua rahasia di sini palsu (bukan token asli).
import http from 'node:http'
import { createWhatsappHandler } from '../server/whatsapp/http.ts'
import { sendViaFonnte } from '../server/whatsapp/fonnte.ts'
import { normalizePhone } from '../server/whatsapp/phone.ts'
import { createSupabaseStore } from '../server/whatsapp/store.ts'
import apiHandler from '../api/whatsapp.ts'

const SECRET = 'secret-palsu-untuk-uji-lokal'
const TOKEN_PALSU = 'token-fonnte-palsu'
const NOMOR = '628111222333'

let gagal = 0
let lulus = 0

function cek(nama, kondisi, tambahan) {
  if (kondisi) {
    lulus += 1
    console.log(`  ✓ ${nama}`)
  } else {
    gagal += 1
    console.log(`  ✗ ${nama}`)
    if (tambahan !== undefined) console.log('    ->', tambahan)
  }
}

// ---------- store in-memory pengganti Supabase ----------
function createMemoryStore(anggotaAwal = []) {
  const sesi = new Map()
  const anggota = anggotaAwal.map((row, index) => ({
    id: row.id || `seed_${index}`,
    nama: row.nama,
    no_hp: row.no_hp,
  }))
  const disimpan = []

  return {
    disimpan,
    async getSession(nomor) {
      return sesi.get(nomor) ?? null
    },
    async saveSession(session) {
      sesi.set(session.wa_number, structuredClone(session))
    },
    async clearSession(nomor) {
      sesi.delete(nomor)
    },
    async findByPhone(nomor) {
      return anggota.filter((row) => normalizePhone(row.no_hp) === nomor)
    },
    async insertPendingMember(member) {
      disimpan.push(structuredClone(member))
      anggota.push({ id: member.id, nama: member.nama, no_hp: member.no_hp })
    },
  }
}

// ---------- fetch palsu untuk Fonnte ----------
// Ambil teks pesan dari body form-urlencoded yang akan dikirim ke Fonnte.
function isiPesan(entry) {
  if (!entry) return ''
  return new URLSearchParams(entry.init.body).get('message') || ''
}

function createFakeFonnte() {
  const terkirim = []
  const fetchImpl = async (url, init) => {
    terkirim.push({ url, init })
    return new Response(
      JSON.stringify({ status: true, detail: 'success! message in queue' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )
  }
  return { terkirim, fetchImpl }
}

// ---------- server lokal ----------
function startServer(handler) {
  const server = http.createServer((req, res) => {
    let body = ''
    req.on('data', (chunk) => {
      body += chunk
    })
    req.on('end', async () => {
      const url = new URL(req.url || '/', 'http://127.0.0.1')
      const query = Object.fromEntries(url.searchParams.entries())
      const adapter = {
        status(code) {
          res.statusCode = code
          return adapter
        },
        json(payload) {
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify(payload))
        },
      }
      try {
        await handler({ method: req.method, query, headers: req.headers, body }, adapter)
      } catch (error) {
        res.statusCode = 500
        res.end(String(error))
      }
    })
  })

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve(server))
  })
}

async function kirimWebhook(baseUrl, payload, opsi = {}) {
  const { secret = SECRET, lewatHeader = false, tanpaSecret = false } = opsi
  const params = new URLSearchParams()
  if (!tanpaSecret && !lewatHeader) params.set('secret', secret)
  const headers = { 'Content-Type': 'application/json' }
  if (lewatHeader) headers['x-webhook-secret'] = secret

  const response = await fetch(`${baseUrl}/api/whatsapp?${params.toString()}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  })
  const json = await response.json().catch(() => ({}))
  return { status: response.status, json }
}

function pesanMasuk(text, overrides = {}) {
  return {
    device: '628999888777',
    sender: NOMOR,
    name: 'Penguji',
    message: text,
    inboxid: 12345,
    timestamp: Math.floor(Date.now() / 1000),
    ...overrides,
  }
}

async function main() {
  console.log('\n=== UJI LOKAL WEBHOOK WHATSAPP (tanpa WhatsApp & tanpa Supabase) ===\n')

  // ---------- 0. Handler asli tanpa environment variable ----------
  // Handler di api/whatsapp.ts harus bisa di-import dan menolak GET dengan 405
  // walau belum ada WA_WEBHOOK_SECRET / kunci Supabase sama sekali.
  console.log('0) Handler asli tanpa environment variable')
  {
    const secretSemula = process.env.WA_WEBHOOK_SECRET
    delete process.env.WA_WEBHOOK_SECRET

    let kode = 0
    const res = {
      status(code) {
        kode = code
        return res
      },
      json() {
        return res
      },
    }

    await apiHandler({ method: 'GET', query: {}, headers: {} }, res)
    cek('GET /api/whatsapp dibalas 405 tanpa env', kode === 405, kode)

    if (secretSemula === undefined) delete process.env.WA_WEBHOOK_SECRET
    else process.env.WA_WEBHOOK_SECRET = secretSemula
  }

  // ---------- 1. Keamanan webhook ----------
  console.log('1) Keamanan webhook')
  {
    const store = createMemoryStore()
    const fonnte = createFakeFonnte()
    const handler = createWhatsappHandler({
      getSecret: () => SECRET,
      getStore: () => store,
      sendReply: (target, message, inboxId) =>
        sendViaFonnte({ token: TOKEN_PALSU, target, message, inboxId, fetchImpl: fonnte.fetchImpl }),
      log: () => {},
    })
    const server = await startServer(handler)
    const base = `http://127.0.0.1:${server.address().port}`

    const tanpaSecret = await kirimWebhook(base, pesanMasuk('DAFTAR'), { tanpaSecret: true })
    cek('tanpa secret -> 401', tanpaSecret.status === 401, tanpaSecret)

    const secretSalah = await kirimWebhook(base, pesanMasuk('DAFTAR'), { secret: 'salah' })
    cek('secret salah -> 401', secretSalah.status === 401, secretSalah)

    const tanpaTeks = await kirimWebhook(base, pesanMasuk('   '))
    cek('pesan tanpa teks diabaikan', tanpaTeks.json.ignored === 'tanpa-teks', tanpaTeks)

    const grup = await kirimWebhook(
      base,
      pesanMasuk('DAFTAR', { sender: '628111222333-1600000000@g.us', member: NOMOR }),
    )
    cek('pesan grup diabaikan', grup.json.ignored === 'pesan-grup', grup)

    const diriSendiri = await kirimWebhook(
      base,
      pesanMasuk('DAFTAR', { sender: '628999888777' }),
    )
    cek('pesan dari nomor bot diabaikan', diriSendiri.json.ignored === 'nomor-bot-sendiri', diriSendiri)

    const getMethod = await fetch(`${base}/api/whatsapp?secret=${SECRET}`)
    cek('metode GET ditolak 405', getMethod.status === 405)

    cek('tidak ada balasan terkirim untuk request yang ditolak', fonnte.terkirim.length === 0, fonnte.terkirim.length)

    server.close()
  }

  // ---------- 2. Alur DAFTAR sampai konfirmasi ----------
  console.log('\n2) Alur DAFTAR sampai konfirmasi')
  const store = createMemoryStore()
  const fonnte = createFakeFonnte()
  const handler = createWhatsappHandler({
    getSecret: () => SECRET,
    getStore: () => store,
    sendReply: (target, message, inboxId) =>
      sendViaFonnte({ token: TOKEN_PALSU, target, message, inboxId, fetchImpl: fonnte.fetchImpl }),
    log: () => {},
  })
  const server = await startServer(handler)
  const base = `http://127.0.0.1:${server.address().port}`

  const balasanTerakhir = () => fonnte.terkirim.at(-1)

  {
    const mulai = await kirimWebhook(base, pesanMasuk('DAFTAR'))
    cek('DAFTAR dibalas dengan pertanyaan nama', mulai.json.replied === true)
    cek(
      'isi balasan menyebut Langkah 1',
      isiPesan(fonnte.terkirim.at(-1)).includes('Langkah 1'),
      isiPesan(fonnte.terkirim.at(-1)),
    )
  }

  {
    const salah = await kirimWebhook(base, pesanMasuk('Bunga123'))
    cek(
      'nama dengan angka ditolak dan tetap di langkah 1',
      isiPesan(balasanTerakhir()).includes('Langkah 1'),
      isiPesan(balasanTerakhir()),
    )
    cek('nama tidak valid tidak tersimpan', store.disimpan.length === 0)
  }

  {
    await kirimWebhook(base, pesanMasuk('bunga   br sembiring'))
    const simpan = await store.getSession(NOMOR)
    cek('nama dirapikan (spasi ganda hilang)', simpan?.data?.nama === 'bunga br sembiring', simpan)
    cek('lanjut ke pertanyaan alamat', isiPesan(balasanTerakhir()).includes('Langkah 2'))
  }

  {
    await kirimWebhook(base, pesanMasuk('LEWATI'))
    const sesi = await store.getSession(NOMOR)
    cek('LEWATI pada alamat menyimpan string kosong', sesi?.data?.alamat === '', sesi?.data)
    cek('lanjut ke pertanyaan tempat lahir', isiPesan(balasanTerakhir()).includes('Langkah 3'))
  }

  {
    await kirimWebhook(base, pesanMasuk('Kabanjahe'))
    cek('lanjut ke pertanyaan tanggal lahir', isiPesan(balasanTerakhir()).includes('Langkah 4'))
  }

  {
    await kirimWebhook(base, pesanMasuk('31-02-1990'))
    cek(
      'tanggal tidak valid ditolak (31 Februari)',
      isiPesan(balasanTerakhir()).includes('Langkah 4'),
      isiPesan(balasanTerakhir()),
    )
    cek('belum ada data tersimpan', store.disimpan.length === 0)
  }

  {
    await kirimWebhook(base, pesanMasuk('17/08/1995'))
    const sesi = await store.getSession(NOMOR)
    cek('tanggal 17/08/1995 disimpan sebagai 1995-08-17', sesi?.data?.tanggal_lahir === '1995-08-17', sesi?.data)
    cek('state pindah ke konfirmasi', sesi?.state === 'konfirmasi', sesi?.state)
    cek('ringkasan menampilkan nama', isiPesan(balasanTerakhir()).includes('bunga br sembiring'))
  }

  {
    const ragu = await kirimWebhook(base, pesanMasuk('mungkin'))
    cek('jawaban selain YA/TIDAK meminta konfirmasi ulang', ragu.json.replied === true)
    cek('belum ada data tersimpan sebelum YA', store.disimpan.length === 0)
  }

  {
    await kirimWebhook(base, pesanMasuk('YA'))
    cek('setelah YA data tersimpan tepat 1 baris', store.disimpan.length === 1, store.disimpan)
    const anggota = store.disimpan[0] || {}
    cek('id memakai awalan pending_', String(anggota.id).startsWith('pending_'), anggota.id)
    cek('status default Anggota', anggota.status === 'Anggota', anggota.status)
    cek('no_hp memakai nomor WhatsApp pengirim', anggota.no_hp === NOMOR, anggota.no_hp)
    cek('is_pending true (menunggu verifikasi admin)', anggota.is_pending === true)
    cek('tempat lahir tersimpan', anggota.tempat_lahir === 'Kabanjahe', anggota.tempat_lahir)
    cek('tanggal lahir format YYYY-MM-DD', anggota.tanggal_lahir === '1995-08-17', anggota.tanggal_lahir)
    cek('photo & kk kosong', anggota.photo === '' && anggota.kk === '')
    cek('sesi dihapus setelah selesai', (await store.getSession(NOMOR)) === null)
    cek('balasan terakhir berterima kasih', isiPesan(balasanTerakhir()).includes('Terima'))
  }

  // ---------- 3. Adapter Fonnte ----------
  console.log('\n3) Adapter Fonnte (request yang akan dikirim)')
  {
    const terakhir = balasanTerakhir()
    cek('endpoint https://api.fonnte.com/send', terakhir?.url === 'https://api.fonnte.com/send', terakhir?.url)
    cek('metode POST', terakhir?.init?.method === 'POST')
    cek('header Authorization berisi token', terakhir?.init?.headers?.Authorization === TOKEN_PALSU)
    const params = new URLSearchParams(terakhir?.init?.body || '')
    cek('field target = nomor pengirim', params.get('target') === NOMOR, params.get('target'))
    cek('field message terisi', (params.get('message') || '').length > 10)
    cek('field inboxid diteruskan', params.get('inboxid') === '12345', params.get('inboxid'))
    cek('tidak memakai kata Bearer', terakhir?.init?.headers?.Authorization === TOKEN_PALSU)
  }

  // ---------- 4. Deteksi nomor ganda ----------
  console.log('\n4) Deteksi nomor ganda')
  {
    const daftarLagi = await kirimWebhook(base, pesanMasuk('DAFTAR'))
    cek('nomor yang sudah terdaftar langsung ditolak', daftarLagi.json.replied === true)
    cek(
      'balasan menyebut sudah terdaftar',
      isiPesan(fonnte.terkirim.at(-1)).includes('sudah terdaftar'),
      isiPesan(fonnte.terkirim.at(-1)),
    )
    cek('tidak ada baris kedua yang disimpan', store.disimpan.length === 1)
  }

  {
    // Nomor lama di tabel umat ditulis manual: 0812-3456-7890
    const storeLama = createMemoryStore([{ nama: 'Anggota Lama', no_hp: '0812-3456-7890' }])
    const fonnteLama = createFakeFonnte()
    const handlerLama = createWhatsappHandler({
      getSecret: () => SECRET,
      getStore: () => storeLama,
      sendReply: (target, message, inboxId) =>
        sendViaFonnte({ token: TOKEN_PALSU, target, message, inboxId, fetchImpl: fonnteLama.fetchImpl }),
      log: () => {},
    })
    const serverLama = await startServer(handlerLama)
    const baseLama = `http://127.0.0.1:${serverLama.address().port}`

    await kirimWebhook(baseLama, pesanMasuk('DAFTAR', { sender: '6281234567890' }))
    cek(
      'nomor format 08xx dengan strip tetap terdeteksi ganda',
      isiPesan(fonnteLama.terkirim.at(-1)).includes('Anggota Lama'),
      isiPesan(fonnteLama.terkirim.at(-1)),
    )
    cek('tidak ada data baru disimpan', storeLama.disimpan.length === 0)
    serverLama.close()
  }

  // ---------- 5. Perintah BATAL / ULANG / BANTUAN ----------
  console.log('\n5) Perintah BATAL / ULANG / BANTUAN')
  {
    const nomorBaru = '628555666777'
    await kirimWebhook(base, pesanMasuk('DAFTAR', { sender: nomorBaru }))
    await kirimWebhook(base, pesanMasuk('Nama Uji', { sender: nomorBaru }))

    await kirimWebhook(base, pesanMasuk('ULANG', { sender: nomorBaru }))
    cek(
      'ULANG mengulang pertanyaan langkah saat ini',
      isiPesan(fonnte.terkirim.at(-1)).includes('Langkah 2'),
      isiPesan(fonnte.terkirim.at(-1)),
    )

    await kirimWebhook(base, pesanMasuk('BANTUAN', { sender: nomorBaru }))
    cek(
      'BANTUAN menampilkan daftar perintah',
      isiPesan(fonnte.terkirim.at(-1)).includes('BATAL'),
      isiPesan(fonnte.terkirim.at(-1)),
    )

    await kirimWebhook(base, pesanMasuk('BATAL', { sender: nomorBaru }))
    cek(
      'BATAL membatalkan proses',
      isiPesan(fonnte.terkirim.at(-1)).includes('dibatalkan'),
      isiPesan(fonnte.terkirim.at(-1)),
    )
    cek('sesi nomor itu terhapus', (await store.getSession(nomorBaru)) === null)

    await kirimWebhook(base, pesanMasuk('ULANG', { sender: nomorBaru }))
    cek(
      'ULANG tanpa proses aktif memberi arahan DAFTAR',
      isiPesan(fonnte.terkirim.at(-1)).includes('DAFTAR'),
      isiPesan(fonnte.terkirim.at(-1)),
    )
    cek('tidak ada data tambahan tersimpan', store.disimpan.length === 1)
  }

  // ---------- 6. Pesan acak & secret lewat header ----------
  console.log('\n6) Pesan acak & secret lewat header')
  {
    const acak = await kirimWebhook(base, pesanMasuk('assalamualaikum', { sender: '628777888999' }))
    cek('pesan di luar alur dibalas menu', acak.json.replied === true)
    cek(
      'menu menyebut perintah DAFTAR',
      isiPesan(fonnte.terkirim.at(-1)).includes('DAFTAR'),
      isiPesan(fonnte.terkirim.at(-1)),
    )

    const lewatHeader = await kirimWebhook(
      base,
      pesanMasuk('BANTUAN', { sender: '628777888999' }),
      { lewatHeader: true },
    )
    cek('secret lewat header x-webhook-secret diterima', lewatHeader.status === 200, lewatHeader)
  }

  // ---------- 7. Kunci rahasia Supabase (model baru, bukan JWT) ----------
  // Kunci seperti ini hanya boleh dikirim di header `apikey`, bukan Bearer.
  console.log('\n7) Kunci rahasia Supabase hanya lewat header apikey')
  {
    const KUNCI_PALSU = 'kunci-palsu-untuk-uji-header-apikey'
    const panggilan = []
    const fetchSupabase = async (url, init = {}) => {
      panggilan.push({ url: String(url), init })
      if ((init.method || 'GET') === 'GET') {
        return new Response('[]', {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      return new Response(null, { status: 204 })
    }

    const store = createSupabaseStore('https://contoh.supabase.co/', KUNCI_PALSU, fetchSupabase)

    await store.getSession(NOMOR)
    await store.saveSession({
      wa_number: NOMOR,
      state: 'nama',
      data: { nama: 'Uji' },
      push_name: 'Uji',
      updated_at: new Date().toISOString(),
    })
    await store.clearSession(NOMOR)
    await store.findByPhone(NOMOR)
    await store.insertPendingMember({
      id: 'pending_uji',
      nama: 'Uji',
      status: 'Anggota',
      alamat: 'Alamat uji',
      no_hp: NOMOR,
      photo: '',
      kk: '',
      is_pending: true,
      tempat_lahir: '',
      tanggal_lahir: '',
    })

    const headerDari = (entry) => new Headers(entry.init.headers)
    cek('ada 5 permintaan ke Supabase', panggilan.length === 5, panggilan.length)
    cek(
      'setiap permintaan mengirim kunci di header apikey',
      panggilan.every((entry) => headerDari(entry).get('apikey') === KUNCI_PALSU),
    )
    cek(
      'tidak ada Authorization: Bearer berisi kunci',
      panggilan.every((entry) => {
        const auth = headerDari(entry).get('authorization')
        return !auth || !String(auth).includes(KUNCI_PALSU)
      }),
      panggilan.map((entry) => headerDari(entry).get('authorization')),
    )
    cek(
      'semua permintaan menuju /rest/v1 tanpa garis miring ganda',
      panggilan.every((entry) => entry.url.startsWith('https://contoh.supabase.co/rest/v1/')),
      panggilan.map((entry) => entry.url),
    )

    const upsertSesi = panggilan.find(
      (entry) => entry.init.method === 'POST' && entry.url.includes('/wa_sessions'),
    )
    cek(
      'simpan sesi memakai on_conflict=wa_number + merge-duplicates',
      Boolean(upsertSesi) &&
        upsertSesi.url.includes('on_conflict=wa_number') &&
        headerDari(upsertSesi).get('prefer')?.includes('merge-duplicates') === true,
      upsertSesi,
    )

    const hapusSesi = panggilan.find((entry) => entry.init.method === 'DELETE')
    cek(
      'hapus sesi memakai filter wa_number=eq.<nomor>',
      Boolean(hapusSesi) && hapusSesi.url.includes(`wa_number=eq.${NOMOR}`),
      hapusSesi?.url,
    )

    const simpanAnggota = panggilan.find(
      (entry) => entry.init.method === 'POST' && entry.url.endsWith('/umat'),
    )
    cek(
      'simpan anggota mengirim JSON ke tabel umat',
      Boolean(simpanAnggota) &&
        JSON.parse(simpanAnggota.init.body).id === 'pending_uji' &&
        headerDari(simpanAnggota).get('content-type') === 'application/json',
      simpanAnggota?.init.body,
    )
  }

  server.close()

  console.log(`\n=== HASIL: ${lulus} lulus, ${gagal} gagal ===\n`)
  if (gagal > 0) process.exitCode = 1
}

main().catch((error) => {
  console.error('\nUji gagal dijalankan:', error)
  process.exitCode = 1
})
