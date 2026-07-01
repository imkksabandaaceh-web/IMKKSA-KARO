// @ts-nocheck
import React, { useState, useEffect } from 'react'
import LoginForm from './components/LoginForm'
import AdminDashboard from './components/AdminDashboard'
import './App.css'
import AlbumGallery from './components/GaleriView'

const compressImage = (base64: string, maxWidth: number, quality: number): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = base64;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }

      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0, width, height);
        try {
          const compressedBase64 = canvas.toDataURL('image/jpeg', quality);
          resolve(compressedBase64);
        } catch (e) {
          resolve(base64);
        }
      } else {
        resolve(base64);
      }
    };
    img.onerror = () => {
      resolve(base64);
    };
  });
};

const toImageKitUrl = (url: string | undefined | null, width = 800): string => {
  if (!url) return '';
  const endpoint = import.meta.env.VITE_IMAGEKIT_ENDPOINT as string | undefined;
  if (endpoint && url.includes('https://lh3.googleusercontent.com')) {
    const cleanUrl = url.split('?')[0];
    return `${cleanUrl.replace('https://lh3.googleusercontent.com', endpoint)}?tr=w-${width},q-80`;
  }
  return url;
};

// Types
type Tab = 'Beranda' | 'Jadwal Keluarga' | 'Galeri' | 'Pengurus' | 'Data Anggota' | 'Login';

interface ContentBlock {
  type: 'text' | 'image';
  value: string;
}

interface PageContent {
  title: string;
  content: string;
  blocks?: ContentBlock[];
}

interface SiteSettings {
  logo: string;
  title: string;
  pengurusRaw?: string;
}

interface GaleriItem {
  id: string;
  judul: string;
  keterangan?: string;
  url: string;
  driveId: string;
  uploadedAt?: string;
}

// Album berbasis folder Google Drive
interface GaleriAlbum {
  id: string;
  judul: string;       // nama kegiatan / judul album
  keterangan?: string;
  folderId: string;    // ID folder Google Drive
  folderUrl: string;   // link lengkap yang dipaste admin
  addedAt: string;
}

interface UmatRecord {
  id: string;
  nama: string;
  status: string;
  nik: string;
  alamat: string;
  noHp: string;
  photo: string;
  kk: string;
  isPending?: boolean;
}

interface PengurusRecord {
  id: string
  jabatan: string
  nama: string
  photo: string
}

interface FullContent {
  settings: SiteSettings;
  pages: Record<string, PageContent>;
  umat: UmatRecord[];
  pengurus: PengurusRecord[];
  galeri: GaleriItem[];
  galeriAlbum: GaleriAlbum[];
}

const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyynP-phPebHRzTIYciWVhTql8z-modG3AMfZLO15n8uipSsN5WCKswpptms2eU0nT6gQ/exec';

const DEFAULT_CONTENT: FullContent = {
  settings: {
    logo: "/LOGO_KARO.jpg",
    title: "IMKKSA Banda Aceh Sekitar",
  },
  pages: {
    'Beranda': {
      title: 'Selamat Datang di Website Resmi IMKKSA Banda Aceh Sekitar',
      content: '<p>Membangun kebersamaan dan kekeluargaan di tengah masyarakat Banda Aceh Sekitar.</p>'
    },
    'Jadwal Keluarga': {
      title: 'Jadwal Pertemuan Keluarga',
      content: '<p>Informasi mengenai jadwal pertemuan rutin dan kegiatan kekeluargaan IMKKSA Banda Aceh Sekitar.</p>'
    }
  },
  umat: [],
  pengurus: [],
  galeri: [],
  galeriAlbum: []
};

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('Beranda')
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false)
  const [siteContent, setSiteContent] = useState<FullContent>(() => {
    const saved = localStorage.getItem('imkksaSiteContent')
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        const migratedPages = parsed.pages || {};
        if (migratedPages['Jadwal Ibadah']) {
          migratedPages['Jadwal Keluarga'] = migratedPages['Jadwal Ibadah'];
          delete migratedPages['Jadwal Ibadah'];
        }

        let loadedPengurus = parsed.pengurus || [];
        if (parsed.settings && parsed.settings.pengurusRaw) {
          try {
            loadedPengurus = JSON.parse(parsed.settings.pengurusRaw);
          } catch (e) {
            console.error("Gagal parse pengurusRaw:", e);
          }
        }

        return {
          ...DEFAULT_CONTENT,
          ...parsed,
          pages: { ...DEFAULT_CONTENT.pages, ...migratedPages },
          pengurus: loadedPengurus,
          galeri: parsed.galeri || [],
          galeriAlbum: parsed.galeriAlbum || []
        }
      } catch (e) {
        return DEFAULT_CONTENT
      }
    }
    return DEFAULT_CONTENT
  })

  // Langsung tampil jika ada cache localStorage, fetch GScript di background
  const [isLoading, setIsLoading] = useState(() => {
    return !localStorage.getItem('imkksaSiteContent')
  })

  // Editor states
  const [editTitle, setEditTitle] = useState('')
  const [editContent, setEditContent] = useState('')
  const [editLogo, setEditLogo] = useState('')
  const [editSiteTitle, setEditSiteTitle] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [pengurusForm, setPengurusForm] = useState({
    jabatan: 'Ketua',
    nama: '',
    photo: ''
  })

  // Galeri Album states (folder Google Drive)
  const [albumJudul, setAlbumJudul] = useState('')
  const [albumKeterangan, setAlbumKeterangan] = useState('')
  const [albumFolderUrl, setAlbumFolderUrl] = useState('')
  const [isAddingAlbum, setIsAddingAlbum] = useState(false)
  const [albumMsg, setAlbumMsg] = useState<string | null>(null)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [expandedAlbum, setExpandedAlbum] = useState<string | null>(null)



  // Data Anggota states
  const [userSearch, setUserSearch] = useState('')
  const [userSearchQuery, setUserSearchQuery] = useState('')
  const [adminSearch, setAdminSearch] = useState('')
  const [umatForm, setUmatForm] = useState<Omit<UmatRecord, 'id' | 'isPending'>>({
    nama: '', status: 'Anggota', nik: '', alamat: '', noHp: '', photo: '', kk: ''
  })
  const [editingId, setEditingId] = useState<string | null>(null)

  // Non-Admin data anggota flow
  const [showUserForm, setShowUserForm] = useState(false)
  const [userUmatForm, setUserUmatForm] = useState<Omit<UmatRecord, 'id' | 'isPending'>>({
    nama: '', status: 'Anggota', nik: '', alamat: '', noHp: '', photo: '', kk: ''
  })
  const [userSubmitMessage, setUserSubmitMessage] = useState<string | null>(null)
  const [isSubmittingUserForm, setIsSubmittingUserForm] = useState(false)
  const [selectedUmat, setSelectedUmat] = useState<UmatRecord | null>(null)

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  useEffect(() => {
    setIsMobileMenuOpen(false)
  }, [activeTab])

  const fetchData = async (isSilent = false) => {
    if (!isSilent) console.log("Memulai pengambilan data dari Google Drive...");
    try {
      const response = await fetch(`${SCRIPT_URL}?t=${Date.now()}`, { method: 'GET', mode: 'cors', redirect: 'follow' })
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      setFetchError(null);

      const text = await response.text();
      if (!text || text.trim() === '') throw new Error('Response kosong dari server');
      const cleanText = text.replace(/^\uFEFF/, '').trim();
      const data = JSON.parse(cleanText)
      if (data && (data.settings || data.pages)) {
        const migratedPages = { ...data.pages };
        Object.keys(migratedPages).forEach(key => {
          const page = migratedPages[key];
          if (page && !page.content && page.blocks) {
            page.content = page.blocks.map((b: any) => {
              if (b.type === 'text') return `<p>${b.value.replace(/\n/g, '<br>')}</p>`;
              if (b.type === 'image') return `<div class="content-image-wrapper"><img src="${b.value}" class="content-image" /></div>`;
              return '';
            }).join('');
          }
        });

        setSiteContent(prev => {
          let currentParsedPengurus = prev.pengurus;
          if (data.settings && data.settings.pengurusRaw) {
            try {
              currentParsedPengurus = JSON.parse(data.settings.pengurusRaw);
            } catch (e) {
              console.error("Gagal parse pengurusRaw:", e);
            }
          }

          const mergedContent = {
            ...prev,
            settings: data.settings ? { ...DEFAULT_CONTENT.settings, ...data.settings } : prev.settings,
            pages: data.pages ? { ...DEFAULT_CONTENT.pages, ...migratedPages } : prev.pages,
            umat: data.umat !== undefined ? data.umat : prev.umat,
            pengurus: currentParsedPengurus,
            galeri: data.galeri || prev.galeri || [],
            galeriAlbum: data.galeriAlbum || prev.galeriAlbum || []
          }

          const isSameUmat = JSON.stringify(prev.umat) === JSON.stringify(mergedContent.umat);
          const isSamePages = JSON.stringify(prev.pages) === JSON.stringify(mergedContent.pages);
          const isSameSettings = JSON.stringify(prev.settings) === JSON.stringify(mergedContent.settings);
          const isSamePengurus = JSON.stringify(prev.pengurus) === JSON.stringify(mergedContent.pengurus);
          const isSameGaleriAlbum = JSON.stringify(prev.galeriAlbum) === JSON.stringify(mergedContent.galeriAlbum);
          const isSameGaleri = JSON.stringify(prev.galeri) === JSON.stringify(mergedContent.galeri);

          if (!isSameUmat || !isSamePages || !isSameSettings || !isSamePengurus || !isSameGaleriAlbum || !isSameGaleri) {
            localStorage.setItem('imkksaSiteContent', JSON.stringify(mergedContent));
            return mergedContent;
          }
          return prev;
        });
      }
    } catch (error) {
      if (!isSilent) {
        console.error("Gagal mengambil data dari Google Drive:", error);
        setFetchError(error instanceof Error ? error.message : String(error));
      }
    } finally {
      if (!isSilent) setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
    const interval = setInterval(() => fetchData(true), 15000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (isLoggedIn) {
      setEditSiteTitle(siteContent.settings.title || '')
      setEditLogo(siteContent.settings.logo || '')
      if (siteContent.pages[activeTab]) {
        setEditTitle(siteContent.pages[activeTab].title || '')
        setEditContent(siteContent.pages[activeTab].content || '')
      }
    }
  }, [isLoggedIn, activeTab, siteContent])

  const handleLogout = () => {
    setIsLoggedIn(false)
    setActiveTab('Beranda')
  }

  const saveChanges = async (updatedData?: any) => {
    setIsSaving(true)
    const finalTitle = updatedData?.title || editTitle
    const finalContent = updatedData?.content || editContent
    const finalSiteTitle = updatedData?.siteTitle || editSiteTitle
    const finalLogo = updatedData?.siteLogo || editLogo

    const newContent = {
      ...siteContent,
      settings: {
        logo: finalLogo,
        title: finalSiteTitle,
        pengurusRaw: siteContent.settings.pengurusRaw
      },
      pages: {
        ...siteContent.pages,
        [activeTab]: { title: finalTitle, content: finalContent }
      }
    }

    setSiteContent(newContent)
    localStorage.setItem('imkksaSiteContent', JSON.stringify(newContent))

    try {
      const payload = JSON.stringify({ action: 'updateContent', data: newContent });
      await fetch(SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain' },
        body: payload,
      })
      if (updatedData) {
        alert('Perubahan telah dikirim! \n\nCatatan: Mohon tunggu 5 detik sebelum merefresh halaman.');
      }
    } catch (error) {
      console.error("Gagal menyimpan ke Google Drive:", error)
      alert('Gagal sinkron ke Google Drive.');
    } finally {
      setIsSaving(false)
    }
  }

  const handleSaveUmat = async () => {
    if (!umatForm.nama.trim()) {
      alert('Nama Anggota harus diisi.')
      return
    }

    let newUmatList = [...siteContent.umat];
    if (editingId) {
      // Edit mode: replace the existing record
      newUmatList = newUmatList.map(u => 
        u.id === editingId ? { ...u, ...umatForm, isPending: false } : u
      );
    } else {
      // Add mode: check if name already exists to avoid duplication
      const nameExists = newUmatList.some(u => !u.isPending && u.nama.toLowerCase() === umatForm.nama.trim().toLowerCase());
      if (nameExists) {
        if (!window.confirm(`Anggota dengan nama "${umatForm.nama}" sudah ada. Apakah Anda ingin memperbarui datanya?`)) {
          return;
        }
        newUmatList = newUmatList.filter(u => u.nama.toLowerCase() !== umatForm.nama.trim().toLowerCase());
      }
      newUmatList.push({ ...umatForm, id: Date.now().toString(), isPending: false });
    }

    const newContent = { ...siteContent, umat: newUmatList }
    setSiteContent(newContent)
    localStorage.setItem('imkksaSiteContent', JSON.stringify(newContent))

    try {
      await fetch(SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ action: 'updateUmat', data: newContent.umat }),
      })
      alert('Data Anggota Berhasil Disimpan!')
    } catch (error) {
      console.error("Gagal sinkron data anggota:", error)
      alert('Gagal menyinkronkan data ke Google Drive.')
    }
    setUmatForm({ nama: '', status: 'Anggota', nik: '', alamat: '', noHp: '', photo: '', kk: '' })
    setEditingId(null)
    setAdminSearch('')
  }

  const handleDeleteUmat = async (id: string, name: string) => {
    if (window.confirm(`Apakah Anda yakin ingin menghapus data anggota: ${name}?`)) {
      const newUmatList = siteContent.umat.filter(u => u.id !== id);
      const newContent = { ...siteContent, umat: newUmatList };
      setSiteContent(newContent);
      localStorage.setItem('imkksaSiteContent', JSON.stringify(newContent));

      try {
        await fetch(SCRIPT_URL, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'text/plain' },
          body: JSON.stringify({ action: 'updateUmat', data: newContent.umat }),
        });
        alert('Data Anggota Berhasil Dihapus!');
      } catch (error) {
        console.error("Gagal menghapus data anggota:", error);
      }

      if (editingId === id) {
        setUmatForm({ nama: '', status: 'Anggota', nik: '', alamat: '', noHp: '', photo: '', kk: '' });
        setEditingId(null);
      }
    }
  }

  const handleApproveUmat = async (umat: UmatRecord) => {
    const cleanList = siteContent.umat.filter(u => u.id !== umat.id && u.nama.toLowerCase() !== umat.nama.toLowerCase());
    const officialUmat = { ...umat, isPending: false };
    const newUmatList = [...cleanList, officialUmat];

    const newContent = { ...siteContent, umat: newUmatList };
    setSiteContent(newContent);
    localStorage.setItem('imkksaSiteContent', JSON.stringify(newContent));

    try {
      await fetch(SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ action: 'updateUmat', data: newContent.umat }),
      })
      alert('Data Anggota Berhasil Disetujui!')
    } catch (error) {
      console.error("Gagal approve data anggota:", error)
    }
  }

  const handleRejectUmat = async (id: string) => {
    if (!window.confirm('Tolak dan hapus data pendaftaran ini?')) return;
    const newUmatList = siteContent.umat.filter(u => u.id !== id);
    const newContent = { ...siteContent, umat: newUmatList };
    setSiteContent(newContent);
    localStorage.setItem('imkksaSiteContent', JSON.stringify(newContent));

    try {
      await fetch(SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ action: 'updateUmat', data: newUmatList }),
      });
      alert('Pendaftaran berhasil ditolak/dihapus.');
    } catch (error) {
      console.error("Gagal sinkron tolak data:", error);
    }
  }

  const handleUserSearch = () => {
    setUserSearchQuery(userSearch.trim());
    setShowUserForm(false);
    setUserSubmitMessage(null);
  }

  const handleUserFormSubmit = async () => {
    if (!userUmatForm.nama.trim()) {
      alert('Nama harus diisi.');
      return;
    }
    setIsSubmittingUserForm(true);
    const pendingRecord: UmatRecord = {
      ...userUmatForm,
      id: `pending_${Date.now()}`,
      isPending: true
    };
    const newContent = { ...siteContent, umat: [...siteContent.umat, pendingRecord] };
    setSiteContent(newContent);
    localStorage.setItem('imkksaSiteContent', JSON.stringify(newContent));

    try {
      await fetch(SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ action: 'updateUmat', data: newContent.umat }),
      });
      setUserSubmitMessage('Data berhasil dikirim! Menunggu verifikasi Admin.');
    } catch {
      setUserSubmitMessage('Data tersimpan lokal. Sinkronisasi akan dicoba ulang.');
    } finally {
      setIsSubmittingUserForm(false);
      setShowUserForm(false);
      setUserUmatForm({ nama: '', status: 'Anggota', nik: '', alamat: '', noHp: '', photo: '', kk: '' });
    }
  }

  const handlePengurusPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result as string;
        const compressed = await compressImage(base64, 400, 0.7);
        setPengurusForm({ ...pengurusForm, photo: compressed });
      };
      reader.readAsDataURL(file);
    }
  }

  const handleSavePengurus = async () => {
    if (!pengurusForm.nama) { alert('Nama pengurus harus diisi.'); return; }
    const newPengurus: PengurusRecord = { ...pengurusForm, id: Date.now().toString() };
    const updatedPengurus = [...(siteContent.pengurus || []).filter(p => p.jabatan !== pengurusForm.jabatan), newPengurus];
    const newContent = {
      ...siteContent,
      pengurus: updatedPengurus,
      settings: { ...siteContent.settings, pengurusRaw: JSON.stringify(updatedPengurus) }
    };
    setSiteContent(newContent);
    localStorage.setItem('imkksaSiteContent', JSON.stringify(newContent));
    try {
      await fetch(SCRIPT_URL, {
        method: 'POST', mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ action: 'updateContent', data: newContent }),
      });
      alert('Data Pengurus Berhasil Disimpan!');
    } catch (error) {
      console.error("Gagal sinkron pengurus:", error);
    }
    setPengurusForm({ jabatan: 'Ketua', nama: '', photo: '' });
  }

  // ── Fungsi helper: ekstrak folder ID dari link Google Drive ──
  const extractFolderId = (url: string): string | null => {
    const trimmed = url.trim();
    // Jika input langsung berupa Folder ID
    if (/^[a-zA-Z0-9_-]{25,50}$/.test(trimmed)) {
      return trimmed;
    }
    // Format: drive.google.com/drive/folders/FOLDER_ID
    const match = trimmed.match(/\/folders\/([a-zA-Z0-9_-]+)/);
    if (match) return match[1];
    // Format: drive.google.com/drive/u/0/folders/FOLDER_ID
    const match2 = trimmed.match(/folders\/([a-zA-Z0-9_-]+)/);
    if (match2) return match2[1];
    return null;
  }

  // ── Tambah Album dari link folder Google Drive ──
  const handleTambahAlbum = async () => {
    if (!albumJudul.trim()) { setAlbumMsg('❌ Judul kegiatan harus diisi.'); return; }
    if (!albumFolderUrl.trim()) { setAlbumMsg('❌ Link folder Google Drive harus diisi.'); return; }

    const folderId = extractFolderId(albumFolderUrl);
    if (!folderId) {
      setAlbumMsg('❌ Link tidak valid. Pastikan link folder Google Drive berbentuk: https://drive.google.com/drive/folders/...');
      return;
    }

    setIsAddingAlbum(true);
    setAlbumMsg('⏳ Menyimpan album...');

    const newAlbum: GaleriAlbum = {
      id: Date.now().toString(),
      judul: albumJudul.trim(),
      keterangan: albumKeterangan.trim() || undefined,
      folderId,
      folderUrl: albumFolderUrl.trim(),
      addedAt: new Date().toISOString()
    };

    const newAlbumList = [...(siteContent.galeriAlbum || []), newAlbum];
    const newContent = { ...siteContent, galeriAlbum: newAlbumList };
    setSiteContent(newContent);
    localStorage.setItem('imkksaSiteContent', JSON.stringify(newContent));

    try {
      await fetch(SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ action: 'updateGaleriAlbum', data: newAlbumList }),
      });
      setAlbumMsg('✅ Album berhasil ditambahkan! Foto dari folder akan tampil di galeri.');
    } catch {
      setAlbumMsg('✅ Album disimpan. Sinkronisasi Drive mungkin tertunda.');
    } finally {
      setIsAddingAlbum(false);
      setAlbumJudul('');
      setAlbumKeterangan('');
      setAlbumFolderUrl('');
      setTimeout(() => setAlbumMsg(null), 5000);
    }
  }

  // ── Hapus Album ──
  const handleHapusAlbum = async (id: string) => {
    if (!window.confirm('Hapus album ini dari Galeri?')) return;
    const newAlbumList = (siteContent.galeriAlbum || []).filter(a => a.id !== id);
    const newContent = { ...siteContent, galeriAlbum: newAlbumList };
    setSiteContent(newContent);
    localStorage.setItem('imkksaSiteContent', JSON.stringify(newContent));
    try {
      await fetch(SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ action: 'updateGaleriAlbum', data: newAlbumList }),
      });
    } catch (e) {
      console.error('Gagal sinkron hapus album:', e);
    }
  }

  // ── Geser urutan Album naik / turun ──
  const handleUrutAlbum = async (id: string, arah: 'naik' | 'turun') => {
    const list = [...(siteContent.galeriAlbum || [])];
    const idx = list.findIndex(a => a.id === id);
    if (arah === 'naik' && idx === 0) return;
    if (arah === 'turun' && idx === list.length - 1) return;
    const tukar = arah === 'naik' ? idx - 1 : idx + 1;
    [list[idx], list[tukar]] = [list[tukar], list[idx]];
    const newContent = { ...siteContent, galeriAlbum: list };
    setSiteContent(newContent);
    localStorage.setItem('imkksaSiteContent', JSON.stringify(newContent));
    try {
      await fetch(SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ action: 'updateGaleriAlbum', data: list }),
      });
    } catch (e) {
      console.error('Gagal sinkron urutan album:', e);
    }
  }


  const renderGaleri = () => {
    const albumList = siteContent.galeriAlbum || [];

    // Helper: URL embed iframe untuk folder Google Drive
    const getFolderEmbedUrl = (folderId: string) =>
      `https://drive.google.com/embeddedfolderview?id=${folderId}#grid`;

    return (
      <div className="page-content">
        {isLoggedIn ? (
          /* ── ADMIN VIEW ── */
          <div className="admin-data-section">
            <h2>Kelola Galeri Kegiatan</h2>

            {/* Form tambah album */}
            <div className="admin-data-form">
              <h3>➕ Tambah Album Kegiatan</h3>
              <p style={{ fontSize: '0.88rem', color: '#555', lineHeight: '1.7', marginBottom: '16px', background: '#f0f7f0', padding: '12px 16px', borderRadius: '8px', borderLeft: '4px solid var(--primary-color)' }}>
                <strong>Cara pakai:</strong><br/>
                1. Upload semua foto kegiatan ke satu <strong>folder Google Drive</strong><br/>
                2. Pastikan folder di-set <em>"Siapa saja yang punya link"</em> bisa melihat<br/>
                3. Salin link folder, paste di bawah → album langsung tampil di galeri situs
              </p>
              <div className="form-grid">
                <div className="form-group">
                  <label>Nama Kegiatan / Judul Album <span style={{ color: 'red' }}>*</span>:</label>
                  <input
                    type="text"
                    placeholder="Contoh: Pertemuan Keluarga Juli 2026"
                    value={albumJudul}
                    onChange={e => setAlbumJudul(e.target.value)}
                    disabled={isAddingAlbum}
                  />
                </div>
                <div className="form-group">
                  <label>Keterangan (opsional):</label>
                  <input
                    type="text"
                    placeholder="Contoh: Dilaksanakan di Sekretariat IMKKSA, 12 Juli 2026"
                    value={albumKeterangan}
                    onChange={e => setAlbumKeterangan(e.target.value)}
                    disabled={isAddingAlbum}
                  />
                </div>
                <div className="form-group full-width">
                  <label>Link Folder Google Drive <span style={{ color: 'red' }}>*</span>:</label>
                  <input
                    type="url"
                    placeholder="https://drive.google.com/drive/folders/..."
                    value={albumFolderUrl}
                    onChange={e => setAlbumFolderUrl(e.target.value)}
                    disabled={isAddingAlbum}
                    style={{ fontFamily: 'monospace', fontSize: '0.88rem' }}
                  />
                </div>
              </div>
              {albumMsg && (
                <div style={{
                  margin: '10px 0', padding: '10px 15px',
                  background: albumMsg.startsWith('✅') ? '#e8f5e9' : albumMsg.startsWith('⏳') ? '#fff8e1' : '#ffebee',
                  borderRadius: '8px', fontSize: '0.9rem',
                  color: albumMsg.startsWith('✅') ? '#2e7d32' : albumMsg.startsWith('⏳') ? '#e65100' : '#c62828'
                }}>
                  {albumMsg}
                </div>
              )}
              <div className="admin-action-buttons">
                <button className="btn-save" onClick={handleTambahAlbum} disabled={isAddingAlbum}>
                  {isAddingAlbum ? '⏳ Menyimpan...' : '📁 Simpan Album'}
                </button>
              </div>
            </div>

            {/* Daftar album */}
            <h3 style={{ marginTop: '30px' }}>Daftar Album ({albumList.length})</h3>
            {albumList.length === 0 ? (
              <p style={{ color: '#888', textAlign: 'center', padding: '20px' }}>
                Belum ada album. Tambah album di atas dengan link folder Google Drive.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '15px' }}>
                {albumList.map((album, idx) => (
                  <div key={album.id} style={{ background: '#f9f9f9', borderRadius: '10px', border: '1px solid #eee', overflow: 'hidden' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', cursor: 'pointer', background: '#fff' }}
                      onClick={() => setExpandedAlbum(expandedAlbum === album.id ? null : album.id)}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>📁 {album.judul}</div>
                        {album.keterangan && <div style={{ fontSize: '0.8rem', color: '#777', marginTop: '2px' }}>{album.keterangan}</div>}
                        <div style={{ fontSize: '0.75rem', color: '#aaa', marginTop: '4px' }}>
                          Ditambahkan: {new Date(album.addedAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                        {/* Tombol geser urutan */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }} onClick={e => e.stopPropagation()}>
                          <button
                            onClick={() => handleUrutAlbum(album.id, 'naik')}
                            disabled={idx === 0}
                            title="Geser ke atas"
                            style={{ padding: '2px 8px', fontSize: '0.75rem', background: idx === 0 ? '#f0f0f0' : '#e8f5e9', border: '1px solid #ccc', borderRadius: '4px', cursor: idx === 0 ? 'not-allowed' : 'pointer', color: idx === 0 ? '#bbb' : '#2e7d32', fontWeight: 700 }}>
                            ▲
                          </button>
                          <button
                            onClick={() => handleUrutAlbum(album.id, 'turun')}
                            disabled={idx === albumList.length - 1}
                            title="Geser ke bawah"
                            style={{ padding: '2px 8px', fontSize: '0.75rem', background: idx === albumList.length - 1 ? '#f0f0f0' : '#e8f5e9', border: '1px solid #ccc', borderRadius: '4px', cursor: idx === albumList.length - 1 ? 'not-allowed' : 'pointer', color: idx === albumList.length - 1 ? '#bbb' : '#2e7d32', fontWeight: 700 }}>
                            ▼
                          </button>
                        </div>
                        <a href={album.folderUrl} target="_blank" rel="noopener noreferrer"
                          style={{ fontSize: '0.78rem', color: '#1a73e8', textDecoration: 'none', padding: '4px 8px', border: '1px solid #1a73e8', borderRadius: '4px' }}
                          onClick={e => e.stopPropagation()}>
                          Buka Drive
                        </a>
                        <button className="btn-delete-small" onClick={e => { e.stopPropagation(); handleHapusAlbum(album.id); }}>Hapus</button>
                        <span style={{ fontSize: '0.8rem', color: '#999' }}>{expandedAlbum === album.id ? '▲' : '▼'}</span>
                      </div>
                    </div>
                     {expandedAlbum === album.id && (
                       <div style={{ padding: '12px' }}>
                       <AlbumGallery
                         folderId={album.folderId}
                         folderUrl={album.folderUrl}
                         scriptUrl={SCRIPT_URL}
                       />
                     </div>
                   )}




                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* ── PUBLIC VIEW ── */
          <div className="page-card">
            <h2>Galeri Kegiatan</h2>
            {albumList.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                {fetchError ? (
                  <div style={{ color: '#c62828', background: '#ffebee', padding: '20px', borderRadius: '10px', maxWidth: '500px', margin: '0 auto', border: '1px solid #ffcdd2', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                    <p style={{ margin: '0 0 8px 0', fontWeight: 'bold', fontSize: '0.95rem' }}>⚠️ Gagal terhubung ke Google Apps Script (Database)</p>
                    <p style={{ margin: '0 0 12px 0', fontSize: '0.85rem', fontFamily: 'monospace', background: '#f5f5f5', padding: '6px', borderRadius: '4px', border: '1px solid #e0e0e0', color: '#333' }}>{fetchError}</p>
                    <p style={{ margin: 0, fontSize: '0.82rem', color: '#555', lineHeight: 1.4 }}>
                      Hal ini biasanya terjadi karena browser Firefox memblokir request pengalihan Google Drive. Coba matikan <strong>Firefox Enhanced Tracking Protection (adblocker)</strong> untuk situs ini, atau buka di Chrome/Edge.
                    </p>
                  </div>
                ) : (
                  <p style={{ color: '#888', margin: 0 }}>
                    Belum ada foto kegiatan yang ditampilkan.
                  </p>
                )}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '32px', marginTop: '24px' }}>
                {albumList.map(album => (
                  <div key={album.id} className="galeri-album-section">
                    {/* Header album */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
                      <div>
                        <h3 style={{ margin: '0 0 4px 0', fontSize: '1.2rem', color: 'var(--primary-color)' }}>
                          📁 {album.judul}
                        </h3>
                        {album.keterangan && (
                          <p style={{ margin: 0, fontSize: '0.88rem', color: '#666' }}>{album.keterangan}</p>
                        )}
                        <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: '#aaa' }}>
                          {new Date(album.addedAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </p>
                      </div>
                      <a
                        href={album.folderUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          fontSize: '0.82rem', color: '#1a73e8', textDecoration: 'none',
                          padding: '6px 12px', border: '1px solid #1a73e8', borderRadius: '6px',
                          whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: '4px'
                        }}
                      >
                        🔗 Lihat di Google Drive
                      </a>
                    </div>
                    
                    {/* Grid foto lintas-browser via AlbumGallery */}
                    <div style={{ borderRadius: '10px', overflow: 'hidden', border: '1px solid #e0e0e0', padding: '12px', background: '#fff' }}>
                     <AlbumGallery
                       folderId={album.folderId}
                       folderUrl={album.folderUrl}
                       scriptUrl={SCRIPT_URL}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, field: 'photo' | 'kk', isAdmin = true) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert("Ukuran file tidak boleh lebih dari 5 MB");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result as string;
        const compressed = await compressImage(base64, 800, 0.6);
        if (isAdmin) {
          setUmatForm(prev => ({ ...prev, [field]: compressed }));
        } else {
          setUserUmatForm(prev => ({ ...prev, [field]: compressed }));
        }
      };
      reader.readAsDataURL(file);
    }
  }

  const renderDataAnggota = () => {
    const pendingUmat = siteContent.umat.filter(u => u.isPending);
    const approvedUmat = siteContent.umat.filter(u => !u.isPending);
    const filteredAdminUmat = adminSearch
      ? approvedUmat.filter(u => u.nama.toLowerCase().includes(adminSearch.toLowerCase()))
      : approvedUmat;

    const filteredUserUmat = approvedUmat.filter(u =>
      u.nama.toLowerCase().includes(userSearchQuery.toLowerCase())
    );

    return (
      <div className="page-content">
        {isLoggedIn ? (
          <div className="admin-data-section">
            <h2>Kelola Data Anggota</h2>
            <div className="admin-data-form">
              <h3>{editingId ? 'Edit Data Anggota' : 'Form Input Anggota Baru'}</h3>
              <div className="form-grid">
                <div className="form-group">
                  <label>Nama Anggota <span style={{ color: 'red' }}>*</span>:</label>
                  <input type="text" value={umatForm.nama} onChange={e => setUmatForm({ ...umatForm, nama: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Status Keanggotaan:</label>
                  <select value={umatForm.status} onChange={e => setUmatForm({ ...umatForm, status: e.target.value })}>
                    <option value="Anggota">Anggota</option>
                    <option value="Pengurus">Pengurus</option>
                    <option value="Non Aktif">Non Aktif</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>NIK:</label>
                  <input type="text" value={umatForm.nik} onChange={e => setUmatForm({ ...umatForm, nik: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>No. HP / WA:</label>
                  <input type="text" value={umatForm.noHp} onChange={e => setUmatForm({ ...umatForm, noHp: e.target.value })} />
                </div>
                <div className="form-group full-width">
                  <label>Alamat:</label>
                  <textarea value={umatForm.alamat} onChange={e => setUmatForm({ ...umatForm, alamat: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Upload Pas Foto (Opsional, Maksimal 5 MB):</label>
                  <input type="file" accept="image/*" onChange={(e) => handleFileChange(e, 'photo', true)} />
                  {umatForm.photo && (
                    <div className="preview-container">
                      <img src={toImageKitUrl(umatForm.photo, 400)} alt="Preview Foto" className="file-preview-img" />
                      <button type="button" className="btn-remove-file" onClick={() => setUmatForm({ ...umatForm, photo: '' })}>Hapus Foto</button>
                    </div>
                  )}
                </div>
                <div className="form-group">
                  <label>Upload KK (Kartu Keluarga - Opsional, Maksimal 5 MB):</label>
                  <input type="file" accept="image/*" onChange={(e) => handleFileChange(e, 'kk', true)} />
                  {umatForm.kk && (
                    <div className="preview-container">
                      <img src={toImageKitUrl(umatForm.kk, 400)} alt="Preview KK" className="file-preview-img" />
                      <button type="button" className="btn-remove-file" onClick={() => setUmatForm({ ...umatForm, kk: '' })}>Hapus KK</button>
                    </div>
                  )}
                </div>
              </div>
              <div className="admin-action-buttons" style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                <button className="btn-save" onClick={handleSaveUmat}>
                  {editingId ? 'Simpan Perubahan' : 'Tambah Anggota'}
                </button>
                {editingId && (
                  <>
                    <button 
                      className="btn-delete" 
                      onClick={() => {
                        setUmatForm({ nama: '', status: 'Anggota', nik: '', alamat: '', noHp: '', photo: '', kk: '' });
                        setEditingId(null);
                      }}
                      style={{ background: '#757575' }}
                    >
                      Batal Edit
                    </button>
                    <button className="btn-delete" onClick={() => handleDeleteUmat(editingId, umatForm.nama)}>
                      Hapus Anggota
                    </button>
                  </>
                )}
              </div>
            </div>
            
            <div className="admin-umat-list" style={{ marginTop: '40px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                <h3>Daftar Anggota Resmi ({approvedUmat.length})</h3>
              </div>
              <input type="text" placeholder="Cari Anggota Resmi..." value={adminSearch} onChange={e => setAdminSearch(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ddd', marginBottom: '15px' }} />
              <div className="table-responsive">
                <table className="umat-table admin-table">
                  <thead>
                    <tr>
                      <th style={{ width: '60px' }}>No</th>
                      <th>Nama</th>
                      <th>Status</th>
                      <th style={{ width: '220px' }}>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAdminUmat.length > 0 ? filteredAdminUmat.map((u, idx) => (
                      <tr key={u.id}>
                        <td>{idx + 1}</td>
                        <td style={{ fontWeight: '600' }}>{u.nama}</td>
                        <td>
                          <span className={`badge-status badge-${u.status.toLowerCase().replace(' ', '')}`}>{u.status}</span>
                        </td>
                        <td>
                          <div className="table-actions">
                            <button className="btn-edit-small" onClick={() => setSelectedUmat(u)} style={{ background: '#e3f2fd', color: '#0d47a1', border: '1px solid #bbdefb' }}>Detail</button>
                            <button className="btn-edit-small" onClick={() => { setUmatForm({ nama: u.nama, status: u.status, nik: u.nik, alamat: u.alamat, noHp: u.noHp, photo: u.photo, kk: u.kk }); setEditingId(u.id); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>Edit</button>
                            <button className="btn-delete-small" onClick={() => handleDeleteUmat(u.id, u.nama)}>Hapus</button>
                          </div>
                        </td>
                      </tr>
                    )) : <tr><td colSpan={4} style={{ textAlign: 'center', padding: '20px', color: '#888' }}>Tidak ada data anggota resmi.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>

            {pendingUmat.length > 0 && (
              <div className="admin-umat-list" style={{ marginTop: '30px' }}>
                <h3>Antrean Persetujuan Mandiri ({pendingUmat.length})</h3>
                <div className="table-responsive">
                  <table className="umat-table admin-table">
                    <thead>
                      <tr>
                        <th style={{ width: '60px' }}>No</th>
                        <th>Nama</th>
                        <th>Status Pengajuan</th>
                        <th style={{ width: '250px' }}>Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pendingUmat.map((u, idx) => (
                        <tr key={u.id}>
                          <td>{idx + 1}</td>
                          <td style={{ fontWeight: '600' }}>{u.nama}</td>
                          <td>
                            <span className="badge-status badge-pending-new">Menunggu Verifikasi</span>
                          </td>
                          <td>
                            <div className="table-actions">
                              <button className="btn-save" style={{ padding: '6px 12px', fontSize: '0.75rem', textTransform: 'none' }} onClick={() => handleApproveUmat(u)}>Approve</button>
                              <button className="btn-edit-small" onClick={() => { setUmatForm({ nama: u.nama, status: u.status || 'Anggota', nik: u.nik, alamat: u.alamat, noHp: u.noHp, photo: u.photo, kk: u.kk }); setEditingId(u.id); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>Edit</button>
                              <button className="btn-delete-small" onClick={() => handleRejectUmat(u.id)}>Tolak</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="user-data-section">
            <div className="user-search-container" style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
              <input 
                type="text" 
                placeholder="Cari Nama Anggota..." 
                value={userSearch} 
                onChange={e => setUserSearch(e.target.value)} 
                onKeyDown={e => { if (e.key === 'Enter') handleUserSearch(); }}
                style={{ flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid #ddd' }} 
              />
              <button className="btn-save" onClick={handleUserSearch} style={{ padding: '0 30px' }}>CARI</button>
              {userSearchQuery && (
                <button 
                  className="btn-edit-small" 
                  onClick={() => { setUserSearch(''); setUserSearchQuery(''); }}
                  style={{ padding: '10px 15px', textTransform: 'none', letterSpacing: 0, fontWeight: 'normal' }}
                >
                  Reset
                </button>
              )}
            </div>

            <div className="search-results-section">
              <div className="table-responsive">
                <table className="umat-table">
                  <thead>
                    <tr>
                      <th style={{ width: '80px' }}>No</th>
                      <th>Nama Anggota</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUserUmat.length > 0 ? (
                      filteredUserUmat.map((u, idx) => (
                        <tr key={u.id}>
                          <td>{idx + 1}</td>
                          <td>
                            <button 
                              onClick={() => setSelectedUmat(u)}
                              style={{ 
                                background: 'none', 
                                border: 'none', 
                                padding: 0, 
                                color: '#1a73e8', 
                                textDecoration: 'underline', 
                                cursor: 'pointer', 
                                fontWeight: '600',
                                textTransform: 'none',
                                letterSpacing: 'normal',
                                textAlign: 'left'
                              }}
                            >
                              {u.nama}
                            </button>
                          </td>
                          <td>
                            <span className={`badge-status badge-${u.status.toLowerCase().replace(' ', '')}`}>
                              {u.status}
                            </span>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={3} style={{ textAlign: 'center', padding: '30px', color: '#888' }}>
                          Data Anggota Tidak Ditemukan
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {filteredUserUmat.length === 0 && (
                <div style={{ textAlign: 'center', marginTop: '20px', marginBottom: '20px' }}>
                  <p style={{ color: '#666', fontSize: '0.9rem', marginBottom: '15px' }}>
                    Nama Anda belum terdaftar? Silakan isi data secara mandiri untuk mendaftar.
                  </p>
                  <button 
                    className="btn-save" 
                    onClick={() => { 
                      setUserUmatForm({ nama: '', status: 'Anggota', nik: '', alamat: '', noHp: '', photo: '', kk: '' }); 
                      setShowUserForm(true); 
                      setUserSubmitMessage(null); 
                    }}
                    style={{ textTransform: 'none', fontSize: '1rem', padding: '12px 30px' }}
                  >
                    📝 Isi secara mandiri
                  </button>
                </div>
              )}
            </div>

            {showUserForm && (
              <div className="modal-overlay" onClick={() => setShowUserForm(false)}>
                <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px', padding: '30px' }}>
                  <button className="modal-header-btn" onClick={() => setShowUserForm(false)}>✕</button>
                  <h3 style={{ borderBottom: '2px solid var(--secondary-color)', paddingBottom: '10px', marginTop: 0, color: 'var(--primary-color)' }}>
                    Lengkapi Data Anggota Mandiri
                  </h3>
                  <p style={{ fontSize: '0.85rem', color: '#666', marginBottom: '20px' }}>
                    Silakan isi formulir di bawah ini dengan lengkap. Data yang dikirim akan tersimpan di Google Drive dan masuk ke antrean verifikasi Admin.
                  </p>
                  
                  <div className="form-grid" style={{ gridTemplateColumns: '1fr' }}>
                    <div className="form-group">
                      <label>Nama Anggota <span style={{ color: 'red' }}>*</span>:</label>
                      <input 
                        type="text" 
                        value={userUmatForm.nama} 
                        onChange={e => setUserUmatForm({ ...userUmatForm, nama: e.target.value })} 
                        required 
                        placeholder="Nama Lengkap Anda"
                      />
                    </div>
                    <div className="form-group">
                      <label>NIK (Nomor Induk Kependudukan - Opsional):</label>
                      <input 
                        type="text" 
                        value={userUmatForm.nik} 
                        onChange={e => setUserUmatForm({ ...userUmatForm, nik: e.target.value })} 
                        placeholder="16 digit nomor NIK"
                      />
                    </div>
                    <div className="form-group">
                      <label>No. HP / WhatsApp (Opsional):</label>
                      <input 
                        type="text" 
                        value={userUmatForm.noHp} 
                        onChange={e => setUserUmatForm({ ...userUmatForm, noHp: e.target.value })} 
                        placeholder="Contoh: 081234567890"
                      />
                    </div>
                    <div className="form-group">
                      <label>Alamat Lengkap (Opsional):</label>
                      <textarea 
                        value={userUmatForm.alamat} 
                        onChange={e => setUserUmatForm({ ...userUmatForm, alamat: e.target.value })} 
                        placeholder="Alamat domisili saat ini di Banda Aceh dan sekitarnya"
                      />
                    </div>
                    <div className="form-group">
                      <label>Upload Pas Foto (Opsional, Maksimal 5 MB):</label>
                      <input 
                        type="file" 
                        accept="image/*" 
                        onChange={(e) => handleFileChange(e, 'photo', false)} 
                      />
                      {userUmatForm.photo && (
                        <div className="preview-container">
                          <img src={toImageKitUrl(userUmatForm.photo, 400)} alt="Preview Foto" className="file-preview-img" />
                          <button type="button" className="btn-remove-file" onClick={() => setUserUmatForm({ ...userUmatForm, photo: '' })}>Hapus Foto</button>
                        </div>
                      )}
                    </div>
                    <div className="form-group">
                      <label>Upload KK (Kartu Keluarga - Opsional, Maksimal 5 MB):</label>
                      <input 
                        type="file" 
                        accept="image/*" 
                        onChange={(e) => handleFileChange(e, 'kk', false)} 
                      />
                      {userUmatForm.kk && (
                        <div className="preview-container">
                          <img src={toImageKitUrl(userUmatForm.kk, 400)} alt="Preview KK" className="file-preview-img" />
                          <button type="button" className="btn-remove-file" onClick={() => setUserUmatForm({ ...userUmatForm, kk: '' })}>Hapus KK</button>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '30px' }}>
                    <button className="btn-delete" onClick={() => setShowUserForm(false)} style={{ textTransform: 'none' }}>
                      Batal
                    </button>
                    <button className="btn-save" onClick={handleUserFormSubmit} disabled={isSubmittingUserForm} style={{ textTransform: 'none' }}>
                      {isSubmittingUserForm ? 'Mengirim...' : 'Kirim Data'}
                    </button>
                  </div>
                </div>
              </div>
            )}
            
            {userSubmitMessage && (
              <div style={{ marginTop: '25px', padding: '15px', backgroundColor: '#e8f5e9', color: '#2e7d32', borderRadius: '8px', textAlign: 'center', fontWeight: '600', border: '1px solid #c8e6c9' }}>
                {userSubmitMessage}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  const renderPengurus = () => {
    const pengurusList = siteContent.pengurus || []
    if (!isLoggedIn) {
      return (
        <div className="page-content">
          <h2>Daftar Pengurus</h2>
          <div className="pengurus-grid">
            {pengurusList.map(p => (
              <div key={p.id} className="pengurus-card">
                {p.photo && <img src={p.photo} alt={p.nama} className="pengurus-photo" />}
                <h3>{p.jabatan}</h3><p>{p.nama}</p>
              </div>
            ))}
          </div>
        </div>
      )
    } else {
      return (
        <div className="page-content">
          <h2>Kelola Pengurus</h2>
          <div className="form-section">
            <label>Jabatan</label>
            <select value={pengurusForm.jabatan} onChange={e => setPengurusForm({ ...pengurusForm, jabatan: e.target.value })}>
              <option value="Ketua">Ketua</option><option value="Wakil Ketua">Wakil Ketua</option><option value="Sekretaris">Sekretaris</option><option value="Wakil Sekretaris">Wakil Sekretaris</option><option value="Bendahara">Bendahara</option><option value="Wakil Bendahara">Wakil Bendahara</option>
            </select>
            <label>Nama</label><input type="text" value={pengurusForm.nama} onChange={e => setPengurusForm({ ...pengurusForm, nama: e.target.value })} />
            <label>Foto</label><input type="file" accept="image/*" onChange={handlePengurusPhoto} />
            <button className="btn-save" onClick={handleSavePengurus}>Simpan Pengurus</button>
          </div>
          <h3>Data Pengurus Saat Ini</h3>
          <ul>{pengurusList.map(p => <li key={p.id}>{p.jabatan}: {p.nama}</li>)}</ul>
        </div>
      )
    }
  }

  const renderPage = () => {
    if (activeTab === 'Login' && !isLoggedIn) {
      return <LoginForm onLoginSuccess={() => { setIsLoggedIn(true); setActiveTab('Beranda'); }} />
    }
    if (activeTab === 'Data Anggota') return renderDataAnggota()
    if (activeTab === 'Galeri') return renderGaleri()
    if (activeTab === 'Pengurus') return renderPengurus()

    // Beranda & Jadwal Keluarga — konten halaman saja, tanpa PDF
    const currentPage = siteContent.pages[activeTab]
    if (!currentPage) return null

    // Helper untuk mengubah Google Drive link di HTML content menjadi ImageKit CDN proxy
    const renderContentHtml = (htmlContent: string) => {
      let content = htmlContent || '';
      content = content.replace(/&nbsp;/g, ' ');
      
      const endpoint = import.meta.env.VITE_IMAGEKIT_ENDPOINT as string | undefined;
      if (endpoint) {
        // Ganti semua https://lh3.googleusercontent.com/d/FILE_ID menjadi ImageKit CDN proxy
        const regex = /https:\/\/lh3\.googleusercontent\.com\/d\/([a-zA-Z0-9_-]+)/g;
        content = content.replace(regex, (match, fileId) => {
          return `${endpoint}/d/${fileId}?tr=w-800,q-80`;
        });
      }
      return { __html: content };
    };

    return (
      <div className="page-content">
        {!isLoggedIn ? (
          <div className="page-card">
            <h2>{currentPage.title}</h2>
            <div className="content-body" dangerouslySetInnerHTML={renderContentHtml(currentPage.content)} />
          </div>
        ) : (
          <AdminDashboard
            initialTitle={editTitle || ''} initialContent={editContent || ''} initialSiteTitle={editSiteTitle || ''} initialSiteLogo={editLogo || ''}
            onSave={(data: any) => { setEditTitle(data.title || ''); setEditContent(data.content || ''); setEditSiteTitle(data.siteTitle || ''); setEditLogo(data.siteLogo || ''); }}
            onPublish={(data: any) => saveChanges(data)} isSaving={isSaving}
            scriptUrl={SCRIPT_URL}
          />
        )}
      </div>
    )
  }
  const renderFormulirPendaftaranModal = () => {
    if (!selectedUmat) return null;
    return (
      <div className="modal-overlay" onClick={() => setSelectedUmat(null)}>
        <div className="modal-content" onClick={e => e.stopPropagation()}>
          <button className="modal-header-btn" onClick={() => setSelectedUmat(null)} title="Tutup">✕</button>
          
          <div className="form-print-area">
            {/* Kop Surat */}
            <div className="kop-surat">
              <img src="/LOGO_KARO.jpg" alt="Logo IMKKSA" className="kop-logo" />
              <div className="kop-text">
                <h2>IKATAN MASYARAKAT KARO KRISTEN SADA ARIH BANDA ACEH SEKITAR</h2>
                <p>Sekretariat: Banda Aceh, Prov. Aceh | Email: imkksa2006@gmail.com</p>
                <p>Website: https://www.imkksa-bandaaceh.site/ | Didirikan: Tahun 2006</p>
              </div>
            </div>

            <div className="form-title">
              Formulir Pendaftaran Anggota
            </div>

            <div className="form-details-grid">
              <div className="details-info">
                <table className="details-table">
                  <tbody>
                    <tr>
                      <td className="label-cell">Nama Lengkap</td>
                      <td className="value-cell">: {selectedUmat.nama}</td>
                    </tr>
                    <tr>
                      <td className="label-cell">NIK / No. KTP</td>
                      <td className="value-cell">: {selectedUmat.nik || '-'}</td>
                    </tr>
                    <tr>
                      <td className="label-cell">No. HP / WA</td>
                      <td className="value-cell">: {selectedUmat.noHp || '-'}</td>
                    </tr>
                    <tr>
                      <td className="label-cell">Alamat Lengkap</td>
                      <td className="value-cell">: {selectedUmat.alamat || '-'}</td>
                    </tr>
                    <tr>
                      <td className="label-cell">Status Keanggotaan</td>
                      <td className="value-cell">
                        : <span className={`badge-status badge-${selectedUmat.status.toLowerCase().replace(' ', '')}`}>{selectedUmat.status}</span>
                      </td>
                    </tr>
                    <tr>
                      <td className="label-cell">Status Verifikasi</td>
                      <td className="value-cell">
                        : <span className="badge-approved" style={{ fontSize: '0.8rem' }}>TERVERIFIKASI ADMIN</span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="details-photo-box">
                {selectedUmat.photo ? (
                  <img src={toImageKitUrl(selectedUmat.photo, 400)} alt="Pas Foto" />
                ) : (
                  <div style={{ width: '120px', height: '160px', border: '2px dashed #ccc', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f0f0f0', borderRadius: '4px', fontSize: '0.8rem', color: '#999', textAlign: 'center', padding: '10px' }}>
                    Pas Foto 3x4
                  </div>
                )}
                <span>Pas Foto Resmi</span>
              </div>
            </div>

            {selectedUmat.kk && (
              <div className="form-attachments">
                <h4>Lampiran Dokumen: Kartu Keluarga (KK)</h4>
                {isLoggedIn ? (
                  <img src={toImageKitUrl(selectedUmat.kk, 800)} alt="Kartu Keluarga" className="attachment-kk" />
                ) : (
                  <div className="kk-locked-box">
                    <div className="kk-locked-content">
                      <div className="kk-locked-icon">🔒</div>
                      <p className="kk-locked-text">hanya admin yg bisa melihat tampilan KK</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Bagian Tanda Tangan */}
            <div className="signature-section">
              <div className="signature-box">
                <p>Banda Aceh, {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                <p style={{ fontWeight: 'bold' }}>Pengurus IMKKSA</p>
                <div className="signature-space">
                  {/* Decorative verified stamp */}
                  <div style={{ border: '2px solid #2e7d32', color: '#2e7d32', width: '140px', padding: '5px', margin: '15px auto 0', transform: 'rotate(-5deg)', borderRadius: '6px', fontWeight: 'bold', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '1px' }}>
                    ✔ VERIFIED
                  </div>
                </div>
                <p style={{ textDecoration: 'underline', fontWeight: 'bold' }}>Panitia Keanggotaan</p>
              </div>
            </div>
          </div>

          <div className="modal-footer-actions">
            <button className="btn-save" onClick={() => window.print()} style={{ textTransform: 'none', display: 'flex', alignItems: 'center', gap: '8px' }}>
              🖨️ Cetak Formulir
            </button>
            <button className="btn-delete" onClick={() => setSelectedUmat(null)} style={{ textTransform: 'none' }}>
              Tutup
            </button>
          </div>
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="loading-screen">
        <div className="loading-logo-container"><img src="/LOGO_KARO.jpg" alt="Logo IMKKSA" /></div>
        <p>Membuka situs IMKKSA Banda Aceh Sekitar...</p>
      </div>
    )
  }

  return (
    <div className="app-container">
      <header className="header">
        <div className="logo-container"><img src="/LOGO_KARO.jpg" alt="Logo IMKKSA" /></div>
        <h1>{siteContent.settings.title}</h1>
      </header>
      <nav className="navbar">
        <div className="mobile-menu-toggle" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>{isMobileMenuOpen ? '✕' : '☰'} Menu</div>
        <ul className={`nav-links ${isMobileMenuOpen ? 'mobile-open' : ''}`}>
          <li className={activeTab === 'Beranda' ? 'active' : ''} onClick={() => setActiveTab('Beranda')}>Beranda</li>
          <li className={activeTab === 'Jadwal Keluarga' ? 'active' : ''} onClick={() => setActiveTab('Jadwal Keluarga')}>Jadwal Keluarga</li>
          <li className={activeTab === 'Galeri' ? 'active' : ''} onClick={() => setActiveTab('Galeri')}>Galeri</li>
          <li className={activeTab === 'Data Anggota' ? 'active' : ''} onClick={() => setActiveTab('Data Anggota')}>Data Anggota</li>
          <li className={activeTab === 'Pengurus' ? 'active' : ''} onClick={() => setActiveTab('Pengurus')}>Pengurus</li>
          {isLoggedIn ? (
            <li onClick={handleLogout}>Logout (Admin)</li>
          ) : (
            <li className={activeTab === 'Login' ? 'active' : ''} onClick={() => setActiveTab('Login')}>Login</li>
          )}
        </ul>
      </nav>
      <main className="main-content">{renderPage()}</main>
      <footer className="footer">&copy; 2026 IMKKSA Banda Aceh Sekitar. All Rights Reserved.</footer>
      {renderFormulirPendaftaranModal()}
    </div>
  )
}

export default App;