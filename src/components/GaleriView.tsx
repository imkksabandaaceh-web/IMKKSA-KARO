// GaleriView.tsx
// Solusi galeri lintas-browser (Chrome, Firefox, Edge, Safari)
// Menggunakan ImageKit sebagai CDN proxy menggantikan iframe Google Drive
//
// ── CARA SETUP IMAGEKIT (lakukan sekali saja) ──────────────────────────────
// 1. Daftar gratis di https://imagekit.io  (20GB bandwidth/bulan gratis)
// 2. Masuk Dashboard → "External Storage" → "Add New Origin"
//    • Type          : Web Proxy
//    • Name          : google-drive (atau apapun)
//    • Base URL      : https://lh3.googleusercontent.com
// 3. Catat "URL Endpoint" Anda, bentuknya:
//      https://ik.imagekit.io/USERNAME_ANDA
// 4. Isi VITE_IMAGEKIT_ENDPOINT di file .env:
//      VITE_IMAGEKIT_ENDPOINT=https://ik.imagekit.io/USERNAME_ANDA
// ───────────────────────────────────────────────────────────────────────────
//
// ── CARA KERJA ───────────────────────────────────────────────────────────────
// Google Drive menyimpan thumbnail foto di:
//   https://lh3.googleusercontent.com/d/FILE_ID
// ImageKit menjadi proxy di depannya, menyelesaikan CORS & iframe block.
// Daftar file dibaca dari Google Drive JSON feed (public, tanpa API key).
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect, useCallback, useRef } from 'react';

// ── Konfigurasi ──────────────────────────────────────────────────────────────
const IMAGEKIT_ENDPOINT = (import.meta.env.VITE_IMAGEKIT_ENDPOINT as string | undefined) || 'https://ik.imagekit.io/imkksa';

// Konversi URL lh3.googleusercontent.com → ImageKit proxy
// Jika ImageKit belum dikonfigurasi, gunakan Google Drive thumbnail yang kompatibel dengan semua browser (Chrome, Firefox, Edge, Safari)
const toImageKitUrl = (fileId: string, width = 800): string => {
  if (IMAGEKIT_ENDPOINT) {
    const googleThumbUrl = `/d/${fileId}`;
    // Format: https://ik.imagekit.io/USERNAME/d/FILE_ID?tr=w-800,q-80
    return `${IMAGEKIT_ENDPOINT}${googleThumbUrl}?tr=w-${width},q-80`;
  }
  // Fallback lintas-browser menggunakan direct thumbnail Google Drive
  return `https://drive.google.com/thumbnail?id=${fileId}&sz=w${width}`;
};

// ── Types ─────────────────────────────────────────────────────────────────────
interface DriveFile {
  id: string;
  name: string;
  thumbnailUrl: string;
  fullUrl: string;
  viewUrl: string; // link buka di Google Drive
}

interface AlbumPhotosState {
  status: 'idle' | 'loading' | 'success' | 'error';
  files: DriveFile[];
  nextPageToken: string | null; // ada isinya kalau masih ada foto lain yang belum diambil
  error?: string;
}

// Jumlah foto yang diambil pada pemuatan pertama (preview cepat).
// Sisanya baru diambil saat tombol "Lihat Semua Foto" diklik.
const PREVIEW_LIMIT = 12;

// ── Helper: ambil daftar file dari folder Google Drive (public JSON feed) ────
// Google Drive menyediakan RSS/Atom feed publik yang bisa dibaca tanpa API key.
// Format: https://drive.google.com/drive/folders/FOLDER_ID?usp=sharing
// Namun untuk daftar file, kita pakai endpoint tidak resmi yang masih bekerja:
// https://drive.google.com/embeddedfolderview?id=FOLDER_ID&resourcekey=&usp=sharing
// Karena CORS, kita pakai alternatif: Google Drive export JSON via Apps Script
// ATAU gunakan pendekatan langsung: baca thumbnailnya dari file IDs yang diketahui.
//
// Pendekatan terbaik tanpa backend:
// Gunakan Google Drive "sharing" link dan extract file list via
// https://drive.google.com/drive/folders/FOLDER_ID
// Sayangnya ini butuh API key. Solusi yang benar-benar zero-backend:
// Gunakan GOOGLE_SCRIPT_URL yang sudah ada di project untuk listing folder.

interface FetchFilesResult {
  files: DriveFile[];
  nextPageToken: string | null;
}

const fetchFolderFiles = async (
  folderId: string,
  scriptUrl: string,
  limit?: number,
  pageToken?: string | null
): Promise<FetchFilesResult> => {
  // Panggil Google Apps Script yang sudah ada (action=listFolder).
  // limit → hanya minta segini banyak foto (preview cepat).
  // pageToken → lanjutkan dari posisi terakhir, bukan dari awal folder lagi.
  const qs = new URLSearchParams({
    action: 'listFolder',
    folderId,
    t: Date.now().toString(),
  });
  if (limit) qs.set('limit', String(limit));
  if (pageToken) qs.set('pageToken', pageToken);

  const url = `${scriptUrl}?${qs.toString()}`;
  const response = await fetch(url, { method: 'GET', mode: 'cors', redirect: 'follow' });

  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  const text = await response.text();
  const clean = text.replace(/^\uFEFF/, '').trim();
  const data = JSON.parse(clean);

  if (!data.files || !Array.isArray(data.files)) {
    throw new Error(data.error || 'Format respons tidak dikenali');
  }

  return {
    files: data.files.map((f: any) => ({
      id: f.id,
      name: f.name,
      thumbnailUrl: toImageKitUrl(f.id, 400),
      fullUrl: toImageKitUrl(f.id, 1200),
      viewUrl: `https://drive.google.com/file/d/${f.id}/view`,
    })),
    nextPageToken: data.nextPageToken || null,
  };
};

// ── Komponen: Lightbox ────────────────────────────────────────────────────────
interface LightboxProps {
  files: DriveFile[];
  startIndex: number;
  onClose: () => void;
}

const Lightbox: React.FC<LightboxProps> = ({ files, startIndex, onClose }) => {
  const [current, setCurrent] = useState(startIndex);

  const goPrev = useCallback(() => setCurrent(i => Math.max(0, i - 1)), []);
  const goNext = useCallback(() => setCurrent(i => Math.min(files.length - 1, i + 1)), [files.length]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') goPrev();
      if (e.key === 'ArrowRight') goNext();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose, goPrev, goNext]);

  const file = files[current];

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.92)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
      }}
      onClick={onClose}
    >
      {/* Kontrol atas */}
      <div
        style={{ position: 'absolute', top: 16, right: 16, display: 'flex', gap: '8px' }}
        onClick={e => e.stopPropagation()}
      >
        <a
          href={file.viewUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            color: '#fff', textDecoration: 'none',
            padding: '6px 12px', border: '1px solid rgba(255,255,255,0.4)',
            borderRadius: '6px', fontSize: '0.8rem', background: 'rgba(255,255,255,0.1)',
          }}
        >
          ↗ Buka di Drive
        </a>
        <button
          onClick={onClose}
          style={{
            background: 'rgba(255,255,255,0.15)', border: 'none',
            color: '#fff', fontSize: '1.2rem', cursor: 'pointer',
            borderRadius: '6px', padding: '6px 12px', lineHeight: 1,
          }}
        >
          ✕
        </button>
      </div>

      {/* Gambar utama */}
      <div style={{ maxWidth: '90vw', maxHeight: '80vh', position: 'relative' }} onClick={e => e.stopPropagation()}>
        <img
          src={file.fullUrl}
          alt={file.name}
          style={{
            maxWidth: '90vw', maxHeight: '80vh',
            objectFit: 'contain', borderRadius: '8px',
            display: 'block',
          }}
          onError={e => {
            // fallback ke Google Drive langsung jika ImageKit gagal
            (e.target as HTMLImageElement).src = `https://drive.google.com/thumbnail?id=${file.id}&sz=w1200`;
          }}
        />
      </div>

      {/* Navigasi */}
      <div style={{ display: 'flex', gap: '16px', marginTop: '16px', alignItems: 'center' }} onClick={e => e.stopPropagation()}>
        <button
          onClick={goPrev}
          disabled={current === 0}
          style={{
            background: current === 0 ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.2)',
            border: 'none', color: '#fff', fontSize: '1.4rem',
            cursor: current === 0 ? 'not-allowed' : 'pointer',
            borderRadius: '50%', width: '44px', height: '44px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >‹</button>

        <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.85rem', minWidth: '80px', textAlign: 'center' }}>
          {current + 1} / {files.length}
        </span>

        <button
          onClick={goNext}
          disabled={current === files.length - 1}
          style={{
            background: current === files.length - 1 ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.2)',
            border: 'none', color: '#fff', fontSize: '1.4rem',
            cursor: current === files.length - 1 ? 'not-allowed' : 'pointer',
            borderRadius: '50%', width: '44px', height: '44px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >›</button>
      </div>

      {/* Nama file */}
      <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.78rem', marginTop: '8px', maxWidth: '80vw', textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {file.name}
      </p>
    </div>
  );
};

// ── Komponen: AlbumGallery (satu album = satu folder Drive) ──────────────────
interface AlbumGalleryProps {
  folderId: string;
  folderUrl: string;
  scriptUrl: string;
}

const AlbumGallery: React.FC<AlbumGalleryProps> = ({ folderId, folderUrl, scriptUrl }) => {
  const [state, setState] = useState<AlbumPhotosState>({ status: 'idle', files: [], nextPageToken: null });
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  // ── State untuk fitur "preview + Lihat Semua" ───────────────────────────
  const [expanded, setExpanded] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // ── Ref untuk lazy-load: album baru fetch saat terlihat di layar ────────
  const containerRef = useRef<HTMLDivElement>(null);
  const hasStartedRef = useRef(false);

  const cacheKey = `galeri_cache_${folderId}`;

  // Ambil PREVIEW foto saja (cepat), dengan cache session & retry otomatis
  // kalau gagal (Apps Script punya batas kuota eksekusi/menit; kalau banyak
  // album dimuat bersamaan, sebagian bisa gagal sesaat lalu berhasil kalau
  // dicoba ulang). Cache hanya dipakai kalau sebelumnya sudah pernah dimuat
  // LENGKAP (full), supaya tidak menyimpan potongan data yang tidak lengkap.
  const loadPreview = useCallback((attempt = 1) => {
    if (attempt === 1) {
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (parsed.full && Array.isArray(parsed.files)) {
            setState({ status: 'success', files: parsed.files, nextPageToken: null });
            return;
          }
        } catch {
          // cache rusak, lanjut fetch normal di bawah
        }
      }
      setState({ status: 'loading', files: [], nextPageToken: null });
    }

    fetchFolderFiles(folderId, scriptUrl, PREVIEW_LIMIT)
      .then(({ files, nextPageToken }) => {
        setState({ status: 'success', files, nextPageToken });
        // Kalau ternyata semua foto sudah termuat dalam preview ini (album kecil),
        // langsung simpan sebagai cache "full".
        if (!nextPageToken) {
          try {
            sessionStorage.setItem(cacheKey, JSON.stringify({ files, full: true }));
          } catch {
            // sessionStorage penuh/tidak tersedia, abaikan saja (tidak fatal)
          }
        }
      })
      .catch(err => {
        console.error(`[GaleriView] Gagal memuat foto (percobaan ${attempt}):`, err);
        if (attempt < 3) {
          // coba lagi otomatis dengan jeda yang makin lama (1.5s, 3s)
          setTimeout(() => loadPreview(attempt + 1), attempt * 1500);
        } else {
          setState({ status: 'error', files: [], nextPageToken: null, error: err.message });
        }
      });
  }, [folderId, scriptUrl, cacheKey]);

  // Ambil SISA foto (dipanggil saat tombol "Lihat Semua Foto" diklik).
  // Melanjutkan dari nextPageToken yang sudah ada, bukan scan folder dari awal.
  const loadRemaining = useCallback(async () => {
    setLoadingMore(true);
    try {
      let allFiles = state.files;
      let token = state.nextPageToken;
      while (token) {
        const { files: more, nextPageToken } = await fetchFolderFiles(folderId, scriptUrl, undefined, token);
        allFiles = [...allFiles, ...more];
        token = nextPageToken;
      }
      setState({ status: 'success', files: allFiles, nextPageToken: null });
      try {
        sessionStorage.setItem(cacheKey, JSON.stringify({ files: allFiles, full: true }));
      } catch {
        // abaikan, tidak fatal
      }
      setExpanded(true);
    } catch (err: any) {
      console.error('[GaleriView] Gagal memuat sisa foto:', err);
      // biarkan preview yang sudah ada tetap tampil, jangan ganggu UX yang sudah berjalan
    } finally {
      setLoadingMore(false);
    }
  }, [folderId, scriptUrl, state.files, state.nextPageToken, cacheKey]);

  // Mulai memuat HANYA saat album ini mendekati area layar (lazy-load),
  // supaya tidak semua album menembak Apps Script bersamaan sekaligus.
  useEffect(() => {
    hasStartedRef.current = false;
    setState({ status: 'idle', files: [], nextPageToken: null });
    setExpanded(false);

    if (!containerRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !hasStartedRef.current) {
          hasStartedRef.current = true;
          loadPreview(1);
          observer.disconnect();
        }
      },
      { rootMargin: '400px' } // mulai load sedikit sebelum album benar-benar kelihatan
    );
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [folderId, scriptUrl, loadPreview]);

  // Tombol "Lihat Semua" muncul kalau: masih ada halaman berikutnya di server,
  // ATAU semua foto sudah termuat tapi jumlahnya lebih dari batas preview.
  const hasMoreOnServer = state.nextPageToken !== null;
  const showToggleButton = hasMoreOnServer || state.files.length > PREVIEW_LIMIT;
  const visibleFiles = expanded ? state.files : state.files.slice(0, PREVIEW_LIMIT);

  const handleToggleClick = () => {
    if (expanded) {
      setExpanded(false);
      return;
    }
    if (hasMoreOnServer) {
      loadRemaining(); // akan set expanded(true) sendiri setelah selesai
    } else {
      setExpanded(true);
    }
  };

  if (state.status === 'idle' || state.status === 'loading') {
    return (
      <div ref={containerRef} style={{ padding: '32px', textAlign: 'center', color: '#888' }}>
        <div style={{
          width: '36px', height: '36px', borderRadius: '50%',
          border: '3px solid #e0e0e0', borderTopColor: 'var(--primary-color, #2e7d32)',
          animation: 'spin 0.8s linear infinite', margin: '0 auto 12px',
        }} />
        <p style={{ margin: 0, fontSize: '0.9rem' }}>Memuat foto...</p>
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div ref={containerRef} style={{
        padding: '20px 24px', background: '#fff8e1',
        borderRadius: '8px', border: '1px solid #ffe082', fontSize: '0.88rem',
      }}>
        <p style={{ margin: '0 0 8px', fontWeight: 600, color: '#e65100' }}>
          ⚠️ Foto tidak dapat dimuat secara otomatis
        </p>
        <p style={{ margin: '0 0 12px', color: '#5d4037' }}>
          {state.error?.includes('listFolder')
            ? 'Google Apps Script perlu diperbarui untuk mendukung listing folder. Lihat panduan di bawah.'
            : 'Terjadi kesalahan saat mengambil daftar foto dari Google Drive.'}
        </p>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            onClick={() => { hasStartedRef.current = true; loadPreview(1); }}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              color: '#fff', background: 'var(--primary-color, #2e7d32)',
              textDecoration: 'none', border: 'none', cursor: 'pointer',
              padding: '8px 16px', borderRadius: '6px', fontSize: '0.82rem', fontWeight: 600,
            }}
          >
            🔄 Coba Lagi
          </button>
          <a
            href={folderUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              color: '#1a73e8', textDecoration: 'none',
              padding: '8px 16px', border: '1px solid #1a73e8',
              borderRadius: '6px', fontSize: '0.82rem', fontWeight: 600,
            }}
          >
            📂 Lihat foto di Google Drive
          </a>
        </div>
      </div>
    );
  }

  if (state.status === 'success' && state.files.length === 0) {
    return (
      <p ref={containerRef} style={{ textAlign: 'center', color: '#999', padding: '24px 0', fontSize: '0.9rem' }}>
        Folder ini belum berisi foto.
      </p>
    );
  }

  return (
    <div ref={containerRef}>
      {/* Grid foto: hanya render foto yang memang sedang "visible" (preview atau semua) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
          gap: '8px',
        }}
      >
        {visibleFiles.map((file, idx) => (
          <div
            key={file.id}
            onClick={() => setLightboxIndex(idx)}
            style={{
              aspectRatio: '1 / 1',
              borderRadius: '8px',
              overflow: 'hidden',
              cursor: 'pointer',
              background: '#f0f0f0',
              position: 'relative',
              transition: 'transform 0.2s, box-shadow 0.2s',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.transform = 'scale(1.03)';
              (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 16px rgba(0,0,0,0.18)';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.transform = 'scale(1)';
              (e.currentTarget as HTMLElement).style.boxShadow = 'none';
            }}
          >
            <img
              src={file.thumbnailUrl}
              alt={file.name}
              loading="lazy"
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              onError={e => {
                // Fallback ke Google Drive thumbnail langsung
                const el = e.target as HTMLImageElement;
                if (!el.dataset.fallback) {
                  el.dataset.fallback = '1';
                  el.src = `https://drive.google.com/thumbnail?id=${file.id}&sz=w400`;
                }
              }}
            />
          </div>
        ))}
      </div>

      {/* Tombol "Lihat Semua Foto" / "Tampilkan Lebih Sedikit" */}
      {showToggleButton && (
        <div style={{ textAlign: 'center', marginTop: '10px' }}>
          <button
            onClick={handleToggleClick}
            disabled={loadingMore}
            style={{
              background: 'transparent',
              border: '1px solid var(--primary-color, #2e7d32)',
              color: 'var(--primary-color, #2e7d32)',
              fontWeight: 600,
              fontSize: '0.85rem',
              padding: '6px 18px',
              borderRadius: '20px',
              cursor: loadingMore ? 'default' : 'pointer',
              opacity: loadingMore ? 0.7 : 1,
            }}
          >
            {loadingMore
              ? 'Memuat semua foto...'
              : expanded
                ? 'Tampilkan Lebih Sedikit ▲'
                : `Lihat Semua Foto${hasMoreOnServer ? '' : ` (${state.files.length})`} ▾`}
          </button>
        </div>
      )}

      {/* Lightbox */}
      {lightboxIndex !== null && (
        <Lightbox
          files={state.files}
          startIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </div>
  );
};

export default AlbumGallery;
