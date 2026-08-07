-- =============================================================
-- MIGRASI DATA ANGGOTA (UMAT) KE SUPABASE — FASE 2
-- Jalankan di: Supabase Dashboard → SQL Editor → Run
--
-- Tujuan:
--   * Database utama yang cepat & scalable untuk 60+ keluarga,
--     menggantikan Script Properties Apps Script (batas 500 KB).
--   * Publik mencari anggota langsung dari Supabase (index + pagination),
--     tidak perlu mengunduh seluruh data.
--   * Foto & KK TETAP di Google Drive; kolom photo/kk hanya berisi URL
--     (lh3.googleusercontent.com / ik.imagekit.io), bukan base64.
-- =============================================================

-- 1) TABEL umat
--    id text mengikuti format yang sudah dipakai aplikasi:
--    Date.now() untuk anggota resmi, "pending_..." untuk pendaftaran baru.
create table if not exists public.umat (
  id text primary key,
  nama text not null,
  status text not null default 'Anggota',
  nik text,
  alamat text,
  no_hp text,
  photo text,
  kk text,
  is_pending boolean not null default false,
  tempat_lahir text,
  tanggal_lahir text,
  created_at timestamptz not null default now()
);

-- 2) ROW LEVEL SECURITY
--    Publik: hanya boleh MEMBACA anggota yang sudah disetujui admin.
--    Admin (sudah login via Supabase Auth): boleh tulis penuh (insert/update/delete).
alter table public.umat enable row level security;

drop policy if exists "Publik baca anggota disetujui" on public.umat;
create policy "Publik baca anggota disetujui"
  on public.umat for select
  using (is_pending = false);

drop policy if exists "Admin kelola semua umat" on public.umat;
create policy "Admin kelola semua umat"
  on public.umat for all
  to authenticated
  using (true)
  with check (true);

-- 3) INDEX agar pencarian nama cepat walau ratusan baris
--    (pg_trgm untuk pencarian teks yang fleksibel: %nama%)
create extension if not exists pg_trgm;
create index if not exists umat_nama_trgm_idx on public.umat using gin (nama gin_trgm_ops);
create index if not exists umat_is_pending_idx on public.umat (is_pending);
create index if not exists umat_status_idx on public.umat (status);
