// ProposalView.tsx
// Menu "Proposal": buat proposal surat otomatis bernomor, download PDF (1 file),
// tabel riwayat global di Supabase, edit, dan hapus.
// - Admin (login): bisa buat, edit, hapus, unduh.
// - Pengunjung umum: hanya melihat daftar & mengunduh PDF yang sudah dibuat.
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { generateProposalPdf, downloadPdfBytes, type ProposalPdfData } from '../utils/pdfUtils';

interface ProposalRow {
  id: number;
  nomor_surat: string;
  tujuan_surat: string;
  pemohon: string;
  tanggal_surat: string;
  no_urut: number;
  link_download?: string | null;
  created_at?: string;
}

// Bulan Romawi (otomatis mengikuti bulan saat surat dibuat)
const BULAN_ROMWI = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];

const pad3 = (n: number) => String(n).padStart(3, '0');

// Format: 001/PROP/IMKKSA/VIII/2026
const formatNomorSurat = (noUrut: number): string => {
  const now = new Date();
  const bulan = BULAN_ROMWI[now.getMonth()];
  const tahun = now.getFullYear();
  return `${pad3(noUrut)}/PROP/IMKKSA/${bulan}/${tahun}`;
};

const formatTanggal = (iso: string): string => {
  if (!iso) return '-';
  try {
    const d = new Date(iso.length <= 10 ? iso + 'T00:00:00' : iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch {
    return iso;
  }
};

const todayIso = (): string => new Date().toISOString().slice(0, 10);

interface ProposalViewProps {
  isLoggedIn: boolean;
}

export default function ProposalView({ isLoggedIn }: ProposalViewProps) {
  const [rows, setRows] = useState<ProposalRow[]>([]);
  const [pemohon, setPemohon] = useState('');
  const [tujuan, setTujuan] = useState('');
  const [tanggalSurat, setTanggalSurat] = useState(todayIso());
  const [editingId, setEditingId] = useState<number | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [previewNomor, setPreviewNomor] = useState('');

  const loadRows = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('riwayat_download')
        .select('*')
        .order('no_urut', { ascending: false });
      if (error) throw error;
      setRows((data || []) as ProposalRow[]);
    } catch (e) {
      console.error('Gagal memuat riwayat proposal:', e);
      setMsg({ type: 'err', text: 'Gagal memuat riwayat proposal dari server.' });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRows();
  }, [loadRows]);

  // Nomor surat berikutnya = MAX(no_urut) + 1 (mulai 001 jika kosong)
  const getNextNomor = useCallback(async (): Promise<number> => {
    const { data, error } = await supabase
      .from('riwayat_download')
      .select('no_urut')
      .order('no_urut', { ascending: false })
      .limit(1);
    if (error) throw error;
    const max = (data && data.length > 0 ? (data[0] as { no_urut: number }).no_urut : 0) || 0;
    return max + 1;
  }, []);

  // Preview nomor untuk form baru (saat form dibuka / tanggal berubah)
  useEffect(() => {
    if (!isLoggedIn) return;
    let active = true;
    getNextNomor()
      .then((n) => {
        if (active) setPreviewNomor(formatNomorSurat(n));
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [isLoggedIn, getNextNomor]);

  const resetForm = () => {
    setPemohon('');
    setTujuan('');
    setTanggalSurat(todayIso());
    setEditingId(null);
    setMsg(null);
    getNextNomor()
      .then((n) => setPreviewNomor(formatNomorSurat(n)))
      .catch(() => {});
  };

  const doGenerate = async (data: ProposalPdfData) => {
    const bytes = await generateProposalPdf(data);
    const fileName = `Proposal_${data.nomorSurat.replace(/[\/\s]/g, '_')}.pdf`;
    downloadPdfBytes(bytes, fileName);
  };

  const handleSubmit = async () => {
    if (!pemohon.trim()) {
      setMsg({ type: 'err', text: 'Nama pengirim (pemohon) wajib diisi.' });
      return;
    }
    if (!tujuan.trim()) {
      setMsg({ type: 'err', text: 'Nama penerima (tujuan) wajib diisi.' });
      return;
    }
    setIsGenerating(true);
    setMsg(null);
    try {
      if (editingId !== null) {
        // ── EDIT ─────────────────────────────────────────────
        const { error } = await supabase
          .from('riwayat_download')
          .update({ pemohon: pemohon.trim(), tujuan_surat: tujuan.trim(), tanggal_surat: tanggalSurat })
          .eq('id', editingId);
        if (error) throw error;
        await loadRows();
        setMsg({ type: 'ok', text: 'Proposal berhasil diperbarui.' });
      } else {
        // ── BUAT BARU ────────────────────────────────────────
        const noUrut = await getNextNomor();
        const nomorSurat = formatNomorSurat(noUrut);
        const { error } = await supabase
          .from('riwayat_download')
          .insert({
            nomor_surat: nomorSurat,
            tujuan_surat: tujuan.trim(),
            pemohon: pemohon.trim(),
            tanggal_surat: tanggalSurat,
            no_urut: noUrut,
          })
          .select()
          .single();
        if (error) throw error;
        await loadRows();
        setMsg({ type: 'ok', text: `Proposal dibuat: ${nomorSurat}` });
        // Generate & unduh PDF otomatis
        await doGenerate({
          nomorSurat,
          tanggalSurat: formatTanggal(tanggalSurat),
          tujuanSurat: tujuan.trim(),
        });
      }
      resetForm();
    } catch (e) {
      console.error('Gagal simpan proposal:', e);
      setMsg({ type: 'err', text: 'Gagal menyimpan proposal: ' + (e instanceof Error ? e.message : String(e)) });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = async (row: ProposalRow) => {
    setMsg(null);
    try {
      await doGenerate({
        nomorSurat: row.nomor_surat,
        tanggalSurat: formatTanggal(row.tanggal_surat),
        tujuanSurat: row.tujuan_surat,
      });
    } catch (e) {
      console.error('Gagal generate PDF:', e);
      setMsg({ type: 'err', text: 'Gagal membuat PDF. Cek konsol (F12) untuk detail field.' });
    }
  };

  const handleEdit = (row: ProposalRow) => {
    setEditingId(row.id);
    setPemohon(row.pemohon || '');
    setTujuan(row.tujuan_surat || '');
    setTanggalSurat((row.tanggal_surat || todayIso()).slice(0, 10));
    setMsg(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (row: ProposalRow) => {
    if (!window.confirm(`Hapus proposal nomor ${row.nomor_surat}?`)) return;
    try {
      const { error } = await supabase.from('riwayat_download').delete().eq('id', row.id);
      if (error) throw error;
      await loadRows();
      setMsg({ type: 'ok', text: `Proposal ${row.nomor_surat} dihapus.` });
    } catch (e) {
      console.error('Gagal hapus proposal:', e);
      setMsg({ type: 'err', text: 'Gagal menghapus proposal.' });
    }
  };

  const filtered = rows.filter(
    (r) =>
      !search.trim() ||
      r.nomor_surat.toLowerCase().includes(search.toLowerCase()) ||
      r.pemohon.toLowerCase().includes(search.toLowerCase()) ||
      r.tujuan_surat.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="page-content">
      <div className="page-card">
        <h2>📄 Proposal Surat Otomatis</h2>
        <p style={{ fontSize: '0.9rem', color: '#64748b', marginTop: '-8px', marginBottom: '18px' }}>
          Nomor surat dibuat otomatis (contoh: <strong>{previewNomor || '001/PROP/IMKKSA/VIII/2026'}</strong>),
          PDF langsung jadi satu file.
        </p>

        {msg && (
          <div
            style={{
              padding: '10px 14px',
              borderRadius: '8px',
              marginBottom: '14px',
              fontSize: '0.9rem',
              background: msg.type === 'ok' ? '#e8f5e9' : '#fdecea',
              color: msg.type === 'ok' ? '#1b5e20' : '#b71c1c',
              border: `1px solid ${msg.type === 'ok' ? '#a5d6a7' : '#ef9a9a'}`,
            }}
          >
            {msg.text}
          </div>
        )}

        {isLoggedIn ? (
          <div className="admin-data-form">
            <h3>{editingId !== null ? '✏️ Edit Proposal' : '➕ Buat Proposal Baru'}</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px' }}>
              <div>
                <label className="form-label">Nomor Surat (otomatis)</label>
                <input
                  type="text"
                  value={editingId !== null ? (rows.find(r => r.id === editingId)?.nomor_surat || '') : previewNomor}
                  readOnly
                  title="Nomor surat dibuat otomatis oleh sistem"
                  style={{ background: '#f1f5f9', color: '#334155', cursor: 'not-allowed' }}
                  className="form-input"
                />
              </div>
              <div>
                <label className="form-label">Nama Pengirim (2 baris) *</label>
                <textarea
                  rows={2}
                  value={pemohon}
                  onChange={(e) => setPemohon(e.target.value)}
                  placeholder={'cth: Pengurus IMKKSA\nBanda Aceh'}
                  className="form-input"
                  style={{ resize: 'vertical', minHeight: '56px' }}
                />
              </div>
              <div>
                <label className="form-label">Nama Penerima (2 baris) *</label>
                <textarea
                  rows={2}
                  value={tujuan}
                  onChange={(e) => setTujuan(e.target.value)}
                  placeholder={'cth: Kepala Dinas Pendidikan\nKota Banda Aceh'}
                  className="form-input"
                  style={{ resize: 'vertical', minHeight: '56px' }}
                />
              </div>
            </div>
            <p style={{ fontSize: '0.8rem', color: '#94a3b8', margin: '8px 0 0' }}>
              📅 Tanggal surat otomatis mengikuti hari ini.
            </p>
            <div style={{ marginTop: '14px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button className="btn-save" onClick={handleSubmit} disabled={isGenerating}>
                {isGenerating ? '⏳ Menyimpan...' : editingId !== null ? '💾 Simpan Perubahan' : '🚀 PROSES & GENERATE PDF'}
              </button>
              {editingId !== null && (
                <button className="btn-cancel" onClick={resetForm}>
                  Batal
                </button>
              )}
            </div>
          </div>
        ) : (
          <p style={{ fontSize: '0.9rem', color: '#64748b', background: '#f1f5f9', padding: '10px 14px', borderRadius: '8px' }}>
            🔒 Hanya admin yang dapat membuat/mengedit/menghapus proposal. Pengunjung dapat melihat daftar dan mengunduh PDF.
          </p>
        )}

        <div style={{ marginTop: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '12px', flexWrap: 'wrap' }}>
            <h3 style={{ margin: 0 }}>🗂️ Riwayat Proposal</h3>
            <input
              type="text"
              placeholder="🔍 Cari nomor / pengirim / penerima..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-color, #e5e7eb)', minWidth: '220px', maxWidth: '320px' }}
            />
          </div>

          {isLoading ? (
            <p style={{ textAlign: 'center', color: '#94a3b8', padding: '20px' }}>Memuat riwayat...</p>
          ) : filtered.length === 0 ? (
            <p style={{ textAlign: 'center', color: '#94a3b8', padding: '20px' }}>
              {search ? 'Tidak ada hasil pencarian.' : 'Belum ada proposal. Admin dapat membuat proposal pertama di form di atas.'}
            </p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="umat-table" style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th>No. Surat</th>
                    <th>Pengirim</th>
                    <th>Penerima</th>
                    <th>Tanggal</th>
                    <th style={{ textAlign: 'center' }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((row) => (
                    <tr key={row.id}>
                      <td style={{ fontWeight: 600, color: 'var(--heading-color, #2e7d32)', whiteSpace: 'nowrap' }}>{row.nomor_surat}</td>
                      <td>{row.pemohon || '-'}</td>
                      <td>{row.tujuan_surat || '-'}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>{formatTanggal(row.tanggal_surat)}</td>
                      <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                        <button className="btn-edit-small" onClick={() => handleDownload(row)} title="Unduh PDF proposal ini">
                          ⬇️ Unduh
                        </button>
                        {isLoggedIn && (
                          <>
                            <button className="btn-edit-small" onClick={() => handleEdit(row)} title="Edit proposal">
                              ✏️ Edit
                            </button>
                            <button className="btn-delete-small" onClick={() => handleDelete(row)} title="Hapus proposal">
                              🗑️ Hapus
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
