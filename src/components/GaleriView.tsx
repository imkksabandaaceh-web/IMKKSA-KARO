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

import React, { useState, useEffect, useCallback } from 'react';

// ── Konfigurasi ──────────────────────────────────────────────────────────────
const IMAGEKIT_ENDPOINT = import.meta.env.VITE_IMAGEKIT_ENDPOINT as string | undefined;

// Konversi URL lh3.googleusercontent.com → ImageKit proxy
// Jika ImageKit belum dikonfigurasi, kembalikan URL asli (hanya Chrome yang bisa)
const toImageKitUrl = (fileId: string, width = 800): string => {
  const googleThumbUrl = `/d/${fileId}`;
  if (IMAGEKIT_ENDPOINT) {
    // Format: https://ik.imagekit.io/USERNAME/d/FILE_ID?tr=w-800,q-80
    return `${IMAGEKIT_ENDPOINT}${googleThumbUrl}?tr=w-${width},q-80`;
  }
  // Fallback: langsung ke googleusercontent (hanya Chrome)
  return `https://lh3.googleusercontent.com${googleThumbUrl}`;
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
  error?: string;
}

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

const fetchFolderFiles = async (
  folderId: string,
  scriptUrl: string
): Promise<DriveFile[]> => {
  // Panggil Google Apps Script yang sudah ada, tambahkan action=listFolder
  const url = `${scriptUrl}?action=listFolder&folderId=${encodeURIComponent(folderId)}&t=${Date.now()}`;
  const response = await fetch(url, { method: 'GET', redirect: 'follow' });

  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  const text = await response.text();
  const clean = text.replace(/^\uFEFF/, '').trim();
  const data = JSON.parse(clean);

  if (!data.files || !Array.isArray(data.files)) {
    throw new Error(data.error || 'Format respons tidak dikenali');
  }

  return data.files.map((f: any) => ({
    id: f.id,
    name: f.name,
    thumbnailUrl: toImageKitUrl(f.id, 400),
    fullUrl: toImageKitUrl(f.id, 1200),
    viewUrl: `https://drive.google.com/file/d/${f.id}/view`,
  }));
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
  const [state, setState] = useState<AlbumPhotosState>({ status: 'idle', files: [] });
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  useEffect(() => {
    setState({ status: 'loading', files: [] });
    fetchFolderFiles(folderId, scriptUrl)
      .then(files => setState({ status: 'success', files }))
      .catch(err => {
        console.error('[GaleriView] Gagal memuat foto:', err);
        setState({ status: 'error', files: [], error: err.message });
      });
  }, [folderId, scriptUrl]);

  if (state.status === 'loading') {
    return (
      <div style={{ padding: '32px', textAlign: 'center', color: '#888' }}>
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
      <div style={{
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
    );
  }

  if (state.status === 'success' && state.files.length === 0) {
    return (
      <p style={{ textAlign: 'center', color: '#999', padding: '24px 0', fontSize: '0.9rem' }}>
        Folder ini belum berisi foto.
      </p>
    );
  }

  return (
    <>
      {/* Grid foto */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
        gap: '8px',
      }}>
        {state.files.map((file, idx) => (
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

      {/* Lightbox */}
      {lightboxIndex !== null && (
        <Lightbox
          files={state.files}
          startIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </>
  );
};

export default AlbumGallery;
