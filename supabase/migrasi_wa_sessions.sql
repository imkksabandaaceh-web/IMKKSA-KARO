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

-- 2) NONAKTIFKAN RLS AGAR TIDAK MENGHALANGI SESI SEMENTARA
alter table public.wa_sessions disable row level security;

-- 3) IZIN AKSES UNTUK SERVER & WEBHOOK (WAJIB)
grant select, insert, update, delete on table public.wa_sessions to anon, authenticated, service_role;

-- 4) INDEX bantu untuk pembersihan sesi lama (opsional, murah).
create index if not exists wa_sessions_updated_at_idx
  on public.wa_sessions (updated_at);
