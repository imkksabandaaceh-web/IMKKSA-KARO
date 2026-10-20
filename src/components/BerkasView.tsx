import React, { useMemo } from 'react';

// Tipe folder berkas — dipakai juga oleh App.tsx (settings) dan A.Panel.
export interface FileFolder {
  id: string;
  nama: string;
  deskripsi?: string;
  driveFolderUrl: string;
  locked?: boolean; // true → folder tetap tampil tapi tidak bisa dibuka pengunjung
}

interface BerkasViewProps {
  folders: FileFolder[];
}

const BerkasView: React.FC<BerkasViewProps> = ({ folders }) => {
  // Folder yang belum lengkap (tanpa nama/link) tidak ditampilkan ke pengunjung.
  const visibleFolders = useMemo(
    () => (folders || []).filter(f => f.nama?.trim() && f.driveFolderUrl?.trim()),
    [folders]
  );

  return (
    <div className="page-content berkas-page">
      <h2 className="berkas-title">📁 Berkas</h2>
      <p className="berkas-subtitle">Pilih folder untuk membuka dokumen di Google Drive.</p>

      {visibleFolders.length === 0 ? (
        <p className="berkas-state">Belum ada folder berkas yang ditambahkan admin.</p>
      ) : (
        <div className="berkas-grid">
          {visibleFolders.map(folder => {
            const locked = !!folder.locked;

            // Folder terkunci: tetap tampil, tetapi tidak bisa diklik.
            if (locked) {
              return (
                <div key={folder.id} className="berkas-card locked" aria-disabled="true">
                  <span className="berkas-card-icon" aria-hidden="true">🔒</span>
                  <h3 className="berkas-card-title">{folder.nama}</h3>
                  {folder.deskripsi && <p className="berkas-card-desc">{folder.deskripsi}</p>}
                  <span className="berkas-card-status locked">🔒 Terkunci</span>
                </div>
              );
            }

            // Folder biasa: satu klik langsung membuka Google Drive di tab baru.
            // Memakai <a> (bukan window.open) supaya tidak diblokir browser HP.
            return (
              <a
                key={folder.id}
                className="berkas-card"
                href={folder.driveFolderUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                <span className="berkas-card-icon" aria-hidden="true">📁</span>
                <h3 className="berkas-card-title">{folder.nama}</h3>
                {folder.deskripsi && <p className="berkas-card-desc">{folder.deskripsi}</p>}
                <span className="berkas-card-status">Buka di Google Drive ↗</span>
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default BerkasView;
