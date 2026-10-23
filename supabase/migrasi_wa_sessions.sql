-- =============================================================
-- MIGRASI FITUR WHATSAPP — TABEL SESI PERCAKAPAN
-- Jalankan di: Supabase Dashboard -> SQL Editor -> Run
--
-- Tujuan:
--   Menyimpan "sedang di langkah mana" setiap nomor WhatsApp yang
--   sedang mengisi formulir pendaftaran lewat chat.
--   Tabel ini HANYA diakses oleh server (webhook /api/whatsapp),
--   tidak dibaca browser, jadi tidak dibuat policy RLS.
--
-- Catatan penting:
--   * Tabel anggota `public.umat` TIDAK diubah sama sekali.
--   * Perintah ini aman diulang (CREATE ... IF NOT EXISTS, GRANT berulang).
--   * Tidak ada perintah yang menghapus data atau tabel.
-- =============================================================

create table if not exists public.wa_sessions (
  -- Nomor WhatsApp format internasional tanpa "+", contoh: 628123456789
  wa_number text primary key,
  -- Langkah percakapan: idle, nama, alamat, tempat_lahir, tanggal_lahir, konfirmasi
  state text not null default 'idle',
  -- Data sementara yang sudah diisi (nama, alamat, tempat_lahir, tanggal_lahir)
  data jsonb not null default '{}'::jsonb,
  -- Nama profil WhatsApp pengirim (opsional, untuk sapaan)
  push_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.wa_sessions is
  'Sesi percakapan WhatsApp pendataan anggota (webhook Fonnte). Hanya diakses server memakai service role key.';

-- 2) AKTIFKAN RLS TANPA POLICY
-- anon/authenticated TIDAK bisa membaca/menulis lewat Data API.
alter table public.wa_sessions enable row level security;

-- 3) IZIN AKSES UNTUK SERVER (WAJIB)
-- Sejak 30 Oktober 2026 Supabase tidak lagi memberi izin otomatis ke tabel
-- baru di schema public. Izin tabel (GRANT) berbeda dari RLS: tanpa GRANT,
-- PostgREST menolak dengan "permission denied for table" (kode 42501)
-- walaupun permintaannya memakai service role key.
-- Hanya service_role (dipakai server/webhook) yang diberi izin. Role
-- anon/authenticated sengaja TIDAK diberi izin apa pun, jadi browser tetap
-- tidak bisa menyentuh tabel ini.
grant select, insert, update, delete on table public.wa_sessions to service_role;

-- 4) INDEX bantu untuk pembersihan sesi lama (opsional, murah).
create index if not exists wa_sessions_updated_at_idx
  on public.wa_sessions (updated_at);
