import React, { useCallback, useEffect, useMemo, useState } from 'react';

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
  scriptUrl: string;
}

interface DriveDocument {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  updated: string;
}

interface ListDocumentsResult {
  files: DriveDocument[];
}

// Ambil ID folder dari link Drive yang dipaste admin.
// Mendukung: .../folders/FOLDER_ID, .../u/0/folders/FOLDER_ID, atau ID mentah.
const extractFolderId = (url: string): string | null => {
  const trimmed = (url || '').trim();
  if (/^[a-zA-Z0-9_-]{20,}$/.test(trimmed)) return trimmed;
  const match = trimmed.match(/folders\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
};

// Minta daftar SEMUA file (bukan hanya gambar) ke Apps Script.
const fetchFolderDocuments = async (
  folderId: string,
  scriptUrl: string,
  refresh = false
): Promise<DriveDocument[]> => {
  const qs = new URLSearchParams({
    action: 'listDocuments',
    folderId,
    t: Date.now().toString(),
  });
  if (refresh) qs.set('refresh', '1');

  const response = await fetch(`${scriptUrl}?${qs.toString()}`, {
    method: 'GET',
    mode: 'cors',
    redirect: 'follow',
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  const text = (await response.text()).replace(/^\uFEFF/, '').trim();
  const data: ListDocumentsResult & { error?: string; settings?: unknown } = JSON.parse(text);
  if (!Array.isArray(data.files)) {
    // Deployment Apps Script lama akan membalas data situs (punya `settings`),
    // bukan daftar file — tandai pesan khusus agar admin tahu harus redeploy.
    if (data.settings) {
      throw new Error('Apps Script masih versi lama: action listDocuments belum aktif. Redeploy Apps Script versi baru.');
    }
    throw new Error(data.error || 'Format respons tidak dikenali');
  }

  return data.files.map(f => ({
    id: f.id,
    name: f.name || 'Tanpa nama',
    mimeType: f.mimeType || '',
    size: Number(f.size) || 0,
    updated: f.updated || '',
  }));
};

const getFileIcon = (name: string, mimeType: string): string => {
  if (mimeType.indexOf('image/') === 0) return '🖼️';
  if (mimeType.indexOf('video/') === 0) return '🎬';
  if (mimeType.indexOf('audio/') === 0) return '🎵';
  if (mimeType.indexOf('application/pdf') === 0) return '📕';
  if (mimeType.indexOf('application/vnd.google-apps.spreadsheet') === 0) return '📗';

  const ext = (name.split('.').pop() || '').toLowerCase();
  if (['doc', 'docx', 'rtf', 'odt'].includes(ext)) return '📘';
  if (['xls', 'xlsx', 'csv', 'ods'].includes(ext)) return '📗';
  if (['ppt', 'pptx', 'odp'].includes(ext)) return '📙';
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return '🗜️';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'].includes(ext)) return '🖼️';
  if (['mp4', 'mkv', 'mov', 'avi', 'webm'].includes(ext)) return '🎬';
  if (['mp3', 'wav', 'ogg', 'm4a'].includes(ext)) return '🎵';
  if (['txt', 'md'].includes(ext)) return '📄';
  return '📄';
};

const formatFileSize = (bytes: number): string => {
  if (!bytes || bytes <= 0) return '—';
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  const rounded = size >= 10 || unit === 0 ? Math.round(size) : Math.round(size * 10) / 10;
  return `${rounded} ${units[unit]}`;
};

const formatFileDate = (iso: string): string => {
  if (!iso) return '';
  try {
    const date = new Date(iso);
    if (isNaN(date.getTime())) return '';
    return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return '';
  }
};

const isGoogleNative = (mimeType: string): boolean => mimeType.indexOf('application/vnd.google-apps.') === 0;

const BerkasView: React.FC<BerkasViewProps> = ({ folders, scriptUrl }) => {
  const [selectedFolder, setSelectedFolder] = useState<FileFolder | null>(null);
  const [files, setFiles] = useState<DriveDocument[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  // Folder yang belum lengkap (tanpa nama/link) tidak ditampilkan ke pengunjung.
  const visibleFolders = useMemo(
    () => (folders || []).filter(f => f.nama?.trim() && f.driveFolderUrl?.trim()),
    [folders]
  );

  const loadDocuments = useCallback(async (folder: FileFolder, refresh = false) => {
    const folderId = extractFolderId(folder.driveFolderUrl);
    if (!folderId) {
      setFiles([]);
      setError('Link folder Google Drive tidak valid. Hubungi admin untuk memperbaikinya.');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const list = await fetchFolderDocuments(folderId, scriptUrl, refresh);
      setFiles(list);
    } catch (err: any) {
      setFiles([]);
      setError(
        'Gagal memuat daftar file. Pastikan folder Google Drive dibagikan untuk publik. ' +
        (err?.message ? `(${err.message})` : '')
      );
    } finally {
      setIsLoading(false);
    }
  }, [scriptUrl]);

  // Muat daftar file saat folder dibuka.
  useEffect(() => {
    if (!selectedFolder) return;
    let cancelled = false;
    const run = async () => {
      const folderId = extractFolderId(selectedFolder.driveFolderUrl);
      if (!folderId) {
        setFiles([]);
        setError('Link folder Google Drive tidak valid. Hubungi admin untuk memperbaikinya.');
        return;
      }
      setIsLoading(true);
      setError(null);
      try {
        const list = await fetchFolderDocuments(folderId, scriptUrl);
        if (!cancelled) setFiles(list);
      } catch (err: any) {
        if (!cancelled) {
          setFiles([]);
          setError(
            'Gagal memuat daftar file. Pastikan folder Google Drive dibagikan untuk publik. ' +
            (err?.message ? `(${err.message})` : '')
          );
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    run();
    return () => { cancelled = true; };
  }, [selectedFolder, scriptUrl]);

  const filteredFiles = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return files;
    return files.filter(f => f.name.toLowerCase().includes(q));
  }, [files, query]);

  const backToFolders = () => {
    setSelectedFolder(null);
    setFiles([]);
    setError(null);
    setQuery('');
  };

  // ── Tampilan daftar file di dalam folder ────────────────────────────────
  if (selectedFolder) {
    return (
      <div className="page-content berkas-page">
        <div className="berkas-detail-header">
          <button type="button" className="berkas-back" onClick={backToFolders}>← Kembali ke Berkas</button>
          <div className="berkas-detail-actions">
            <a
              className="berkas-drive-link"
              href={selectedFolder.driveFolderUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              Buka di Google Drive ↗
            </a>
            <button
              type="button"
              className="berkas-refresh"
              onClick={() => loadDocuments(selectedFolder, true)}
              disabled={isLoading}
            >
              {isLoading ? '⏳ Memuat...' : '🔄 Segarkan'}
            </button>
          </div>
        </div>

        <h2 className="berkas-title">{selectedFolder.nama}</h2>
        {selectedFolder.deskripsi && <p className="berkas-subtitle">{selectedFolder.deskripsi}</p>}

        {files.length > 0 && (
          <input
            type="search"
            className="berkas-search"
            placeholder="Cari nama file..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            aria-label="Cari nama file"
          />
        )}

        {isLoading && <p className="berkas-state">⏳ Memuat daftar file...</p>}

        {!isLoading && error && (
          <div className="berkas-state berkas-error">
            <p>{error}</p>
            <div className="berkas-error-actions">
              <button type="button" className="berkas-btn berkas-btn-secondary" onClick={() => loadDocuments(selectedFolder, true)}>
                Coba Lagi
              </button>
              <a
                className="berkas-btn berkas-btn-primary"
                href={selectedFolder.driveFolderUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                Buka di Google Drive ↗
              </a>
            </div>
          </div>
        )}

        {!isLoading && !error && files.length === 0 && (
          <p className="berkas-state">Belum ada file di folder ini.</p>
        )}

        {!isLoading && !error && files.length > 0 && filteredFiles.length === 0 && (
          <p className="berkas-state">Tidak ada file yang cocok dengan pencarian “{query}”.</p>
        )}

        {!isLoading && !error && filteredFiles.length > 0 && (
          <ul className="berkas-file-list">
            {filteredFiles.map(file => {
              const viewUrl = `https://drive.google.com/file/d/${file.id}/view`;
              const downloadUrl = `https://drive.google.com/uc?export=download&id=${file.id}`;
              const canDownload = !isGoogleNative(file.mimeType);
              const meta = [formatFileSize(file.size), formatFileDate(file.updated)].filter(Boolean).join(' · ');
              return (
                <li key={file.id} className="berkas-file">
                  <span className="berkas-file-icon" aria-hidden="true">{getFileIcon(file.name, file.mimeType)}</span>
                  <div className="berkas-file-info">
                    <a href={viewUrl} target="_blank" rel="noopener noreferrer" className="berkas-file-name">
                      {file.name}
                    </a>
                    {meta && <span className="berkas-file-meta">{meta}</span>}
                  </div>
                  <div className="berkas-file-actions">
                    <a href={viewUrl} target="_blank" rel="noopener noreferrer" className="berkas-btn berkas-btn-secondary">
                      Buka
                    </a>
                    {canDownload && (
                      <a href={downloadUrl} target="_blank" rel="noopener noreferrer" className="berkas-btn berkas-btn-primary">
                        ⬇ Unduh
                      </a>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    );
  }

  // ── Tampilan daftar folder ───────────────────────────────────────────────
  return (
    <div className="page-content berkas-page">
      <h2 className="berkas-title">📁 Berkas</h2>
      <p className="berkas-subtitle">Pilih folder untuk melihat dan mengunduh dokumen.</p>

      {visibleFolders.length === 0 ? (
        <p className="berkas-state">Belum ada folder berkas yang ditambahkan admin.</p>
      ) : (
        <div className="berkas-grid">
          {visibleFolders.map(folder => {
            const locked = !!folder.locked;
            return (
              <div
                key={folder.id}
                className={`berkas-card${locked ? ' locked' : ''}`}
                role={locked ? undefined : 'button'}
                tabIndex={locked ? undefined : 0}
                aria-disabled={locked || undefined}
                onClick={locked ? undefined : () => setSelectedFolder(folder)}
                onKeyDown={
                  locked
                    ? undefined
                    : e => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setSelectedFolder(folder);
                        }
                      }
                }
              >
                <span className="berkas-card-icon" aria-hidden="true">{locked ? '🔒' : '📁'}</span>
                <h3 className="berkas-card-title">{folder.nama}</h3>
                {folder.deskripsi && <p className="berkas-card-desc">{folder.deskripsi}</p>}
                <span className={`berkas-card-status${locked ? ' locked' : ''}`}>
                  {locked ? '🔒 Terkunci' : 'Buka folder →'}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default BerkasView;
