// scripts/check-rls-registration.mjs
// Penjaga kontrak: jalur pendaftaran publik (`/daftar`) HARUS memakai INSERT murni.
//
// Alasan: policy RLS untuk role anon di tabel `public.umat` hanya mengizinkan
// INSERT dengan `is_pending = true`. `.upsert()` mengirim
// `INSERT ... ON CONFLICT (id) DO UPDATE`, dan klausa `DO UPDATE` membutuhkan
// policy UPDATE yang tidak dimiliki anon → Supabase menolak 42501 dan
// pendaftaran tidak pernah masuk antrean admin (pernah terjadi, 28 Okt 2026).
//
// Dijalankan otomatis lewat `npm run prebuild` (Vercel) dan langkah CI di
// .github/workflows/ci.yml, sehingga deploy ditolak bila kontrak ini rusak.
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { createClient } from '@supabase/supabase-js'

const root = process.cwd()
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8').replace(/\r\n/g, '\n')

const hasil = []
const cek = (nama, fn) => {
  try {
    fn()
    hasil.push({ ok: true, nama })
  } catch (err) {
    hasil.push({ ok: false, nama, pesan: err instanceof Error ? err.message : String(err) })
  }
}

/** Ambil blok method/berkas di antara dua penanda supaya pemeriksaan tidak melebar. */
const blok = (sumber, mulai, sampai, label) => {
  const dari = sumber.indexOf(mulai)
  assert.ok(dari >= 0, `${label}: penanda "${mulai}" tidak ditemukan`)
  const ke = sumber.indexOf(sampai, dari + mulai.length)
  assert.ok(ke > dari, `${label}: penanda akhir "${sampai}" tidak ditemukan`)
  return sumber.slice(dari, ke)
}

const appTsx = read('src/App.tsx')
const umatTs = read('src/services/umat.ts')
const migrasiSql = read('supabase/migrasi_umat.sql')

// ── 1. Form mandiri tidak boleh memakai upsert ─────────────────────────────
cek('Form /daftar memakai umatService.insert() (bukan upsert)', () => {
  const submit = blok(appTsx, 'const handleUserFormSubmit', 'const handlePengurusPhoto', 'handleUserFormSubmit')
  assert.ok(
    submit.includes('umatService.insert(['),
    'handleUserFormSubmit harus memanggil umatService.insert([...]) — upsert ditolak RLS anon (42501)'
  )
  assert.ok(
    !submit.includes('umatService.upsert('),
    'handleUserFormSubmit tidak boleh memanggil umatService.upsert() — ON CONFLICT DO UPDATE butuh izin UPDATE'
  )
})

// ── 2. Pengiriman ulang antrean memakai DO NOTHING ────────────────────────
cek('Antrean lokal (outbox) memakai umatService.insertIfAbsent()', () => {
  const flush = blok(appTsx, 'const flushUmatOutbox', '// Retry otomatis', 'flushUmatOutbox')
  assert.ok(
    flush.includes('umatService.insertIfAbsent(['),
    'flushUmatOutbox harus memakai umatService.insertIfAbsent() supaya idempoten tanpa izin UPDATE'
  )
})

// ── 3. Bentuk method di service ───────────────────────────────────────────
cek('umatService.insert() = INSERT murni tanpa klausa ON CONFLICT', () => {
  const insert = blok(umatTs, 'async insert(list: UmatRecord[])', 'async insertIfAbsent(', 'umatService.insert')
  assert.ok(insert.includes(".insert(list.map(toDb))"), 'umatService.insert() harus memakai .insert(...)')
  assert.ok(
    !/onConflict|ignoreDuplicates/.test(insert),
    'umatService.insert() tidak boleh memakai onConflict/ignoreDuplicates (menjadi upsert → ditolak RLS anon)'
  )
})

cek('umatService.insertIfAbsent() memakai ON CONFLICT DO NOTHING', () => {
  const ifAbsent = blok(umatTs, 'async insertIfAbsent(', '/** Hapus satu anggota', 'umatService.insertIfAbsent')
  assert.ok(ifAbsent.includes('ignoreDuplicates: true'), 'insertIfAbsent harus ignoreDuplicates: true (DO NOTHING)')
  assert.ok(
    !/resolution=merge-duplicates/.test(ifAbsent),
    'insertIfAbsent tidak boleh memakai merge-duplicates'
  )
})

// ── 4. Policy RLS yang menjadi dasar kontrak di atas ──────────────────────
cek('Policy RLS "pendaftaran publik" (INSERT, is_pending = true) ada di SQL migrasi', () => {
  assert.match(migrasiSql, /for\s+insert/i, 'policy ... for insert tidak ditemukan di supabase/migrasi_umat.sql')
  assert.match(
    migrasiSql,
    /with\s+check\s*\(\s*is_pending\s*=\s*true\s*\)/i,
    'policy INSERT harus memakai with check (is_pending = true)'
  )
})

// ── 5. Perilaku nyata supabase-js terhadap policy INSERT-only ─────────────
// Server tiruan: menolak 42501 untuk merge-duplicates, menerima INSERT & DO NOTHING.
const port = 54391
const diterima = []
const sockets = new Set()
const server = http.createServer((req, res) => {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': '*',
    'Content-Type': 'application/json',
  }
  if (req.method === 'OPTIONS') return void res.writeHead(204, cors).end()
  let body = ''
  req.on('data', (c) => (body += c))
  req.on('end', () => {
    const prefer = String(req.headers.prefer || '')
    if (req.method === 'POST' && req.url.startsWith('/rest/v1/umat')) {
      if (prefer.includes('merge-duplicates')) {
        return void res
          .writeHead(401, cors)
          .end(JSON.stringify({ code: '42501', message: 'new row violates row-level security policy for table "umat"' }))
      }
      diterima.push({ url: req.url, prefer, rows: JSON.parse(body) })
      return void res.writeHead(201, cors).end('')
    }
    res.writeHead(200, cors).end('[]')
  })
})
server.on('connection', (socket) => {
  sockets.add(socket)
  socket.on('close', () => sockets.delete(socket))
})
await new Promise((resolve) => server.listen(port, '127.0.0.1', resolve))

try {
  const client = createClient(`http://127.0.0.1:${port}`, 'anon-key-uji', {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
  const baris = { id: 'pending_uji', nama: 'Uji', status: 'Anggota', alamat: '', no_hp: '', photo: '', kk: '', is_pending: true, tempat_lahir: '', tanggal_lahir: '' }

  const insert = await client.from('umat').insert([baris])
  cek('supabase .insert() lolos policy INSERT-only', () => {
    assert.equal(insert.error, null, `insert() gagal: ${insert.error?.message}`)
    assert.equal(diterima.length, 1)
    assert.ok(!diterima[0].url.includes('on_conflict='), 'insert() tidak boleh mengirim on_conflict')
    assert.ok(!diterima[0].prefer.includes('merge-duplicates'), 'insert() tidak boleh mengirim merge-duplicates')
  })

  const doNothing = await client.from('umat').upsert([baris], { onConflict: 'id', ignoreDuplicates: true })
  cek('supabase upsert(ignoreDuplicates) = DO NOTHING, lolos policy INSERT-only', () => {
    assert.equal(doNothing.error, null, `upsert DO NOTHING gagal: ${doNothing.error?.message}`)
    assert.equal(diterima.length, 2)
    assert.ok(diterima[1].prefer.includes('resolution=ignore-duplicates'), 'harus mengirim resolution=ignore-duplicates')
  })

  const merge = await client.from('umat').upsert([baris], { onConflict: 'id' })
  cek('upsert() biasa memang ditolak policy INSERT-only (dasar larangan di /daftar)', () => {
    assert.ok(merge.error, 'upsert merge-duplicates seharusnya ditolak; policy/penjaga perlu ditinjau')
    assert.equal(merge.error.code, '42501')
  })
} finally {
  // Tutup koneksi keep-alive supaya proses Node keluar bersih (bukan crash) saat gagal.
  for (const socket of sockets) socket.destroy()
  await new Promise((resolve) => server.close(resolve))
}

// ── Laporan ───────────────────────────────────────────────────────────────
const gagal = hasil.filter((h) => !h.ok)
for (const h of hasil) {
  console.log(`${h.ok ? '✅' : '❌'} ${h.nama}`)
  if (!h.ok) console.log(`   → ${h.pesan}`)
}
if (gagal.length > 0) {
  console.error(`\n❌ ${gagal.length} pemeriksaan RLS pendaftaran GAGAL — deploy dibatalkan.`)
  console.error('   Jalur /daftar wajib INSERT murni; lihat komentar di scripts/check-rls-registration.mjs.')
  process.exitCode = 1
}
console.log('\n✅ Kontrak RLS jalur pendaftaran /daftar aman.')
