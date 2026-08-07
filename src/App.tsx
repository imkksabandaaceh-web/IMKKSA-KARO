// @ts-nocheck
import React, { useState, useEffect, useRef, useCallback } from 'react'
import LoginForm from './components/LoginForm'
import AdminDashboard from './components/AdminDashboard'
import APanel from './components/APanel'
import './App.css'
import AlbumGallery from './components/GaleriView'
import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { umatService } from './services/umat'

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

const toImageKitUrl = (url: string | undefined | null, width = 800, cropFace = false): string => {
  if (!url) return '';
  const endpoint = (import.meta.env.VITE_IMAGEKIT_ENDPOINT as string | undefined) || 'https://ik.imagekit.io/imkksa';
  
  const tr = cropFace ? `tr=w-${width},h-${width},fo-face` : `tr=w-${width},q-80`;

  if (url.includes('ik.imagekit.io')) {
    const cleanUrl = url.split('?')[0];
    return `${cleanUrl}?${tr}`;
  }

  let fileId = '';
  const lhMatch = url.match(/lh\d+\.googleusercontent\.com\/(?:u\/\d+\/)?d\/([a-zA-Z0-9_-]+)/);
  if (lhMatch) {
    fileId = lhMatch[1];
  } else {
    const driveIdMatch = url.match(/drive\.google\.com\/.*[?&]id=([a-zA-Z0-9_-]+)/);
    if (driveIdMatch) {
      fileId = driveIdMatch[1];
    } else {
      const drivePathMatch = url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
      if (drivePathMatch) {
        fileId = drivePathMatch[1];
      }
    }
  }

  if (fileId && endpoint) {
    return `${endpoint}/d/${fileId}?${tr}`;
  }

  if (endpoint && url.includes('https://lh3.googleusercontent.com')) {
    const cleanUrl = url.split('?')[0];
    return `${cleanUrl.replace('https://lh3.googleusercontent.com', endpoint)}?${tr}`;
  }

  return url;
};

const formatDateDevice = (dateStr: string | undefined | null): string => {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
  } catch (e) {
    return dateStr;
  }
};

const processHtmlContent = (htmlContent: string): string => {
  let content = htmlContent || '';
  content = content.replace(/&nbsp;/g, ' ');

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(content, 'text/html');
    const links = doc.querySelectorAll('a');
    const endpoint = (import.meta.env.VITE_IMAGEKIT_ENDPOINT as string | undefined) || 'https://ik.imagekit.io/imkksa';

    links.forEach((a) => {
      let href = a.getAttribute('href') || '';
      if (!href) return;
      href = href.trim();

      let fileId = '';
      const lhMatch = href.match(/lh\d+\.googleusercontent\.com\/(?:u\/\d+\/)?d\/([a-zA-Z0-9_-]+)/);
      if (lhMatch) {
        fileId = lhMatch[1];
      } else {
        const driveIdMatch = href.match(/drive\.google\.com\/.*[?&]id=([a-zA-Z0-9_-]+)/);
        if (driveIdMatch) {
          fileId = driveIdMatch[1];
        } else {
          const drivePathMatch = href.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
          if (drivePathMatch) {
            fileId = drivePathMatch[1];
          }
        }
      }

      // Deteksi jika link ini mengarah ke file dokumen/non-gambar
      const isDocument = /\.(pdf|doc|docx|xls|xlsx|ppt|pptx|zip|rar|txt|csv)(\?.*)?$/i.test(href) ||
                         /\.(pdf|doc|docx|xls|xlsx|ppt|pptx|zip|rar|txt|csv)/i.test(a.textContent || '');

      const isImage = (/\.(jpeg|jpg|gif|png|webp|svg|bmp)(\?.*)?$/i.test(href) || fileId !== '') && !isDocument;

      if (isImage) {
        if (fileId && endpoint) {
          href = `${endpoint}/d/${fileId}?tr=w-800,q-80`;
        }
        
        const img = doc.createElement('img');
        img.setAttribute('src', href);
        img.setAttribute('alt', a.textContent || 'Gambar');
        img.setAttribute('style', 'max-width: 100%; height: auto; display: block; margin: 10px 0; border-radius: 8px;');
        a.parentNode?.replaceChild(img, a);
      } else {
        // Jika dokumen dan merupakan link Google Drive, ubah href menjadi ImageKit Proxy
        if (fileId && endpoint) {
          a.setAttribute('href', `${endpoint}/d/${fileId}`);
        }
        a.setAttribute('target', '_blank');
        a.setAttribute('rel', 'noopener noreferrer');
      }
    });

    if (endpoint) {
      const imgs = doc.querySelectorAll('img');
      imgs.forEach((img) => {
        const src = img.getAttribute('src') || '';
        let fileId = '';
        const lhMatch = src.match(/lh\d+\.googleusercontent\.com\/(?:u\/\d+\/)?d\/([a-zA-Z0-9_-]+)/);
        if (lhMatch) {
          fileId = lhMatch[1];
        } else {
          const driveIdMatch = src.match(/drive\.google\.com\/.*[?&]id=([a-zA-Z0-9_-]+)/);
          if (driveIdMatch) {
            fileId = driveIdMatch[1];
          } else {
            const drivePathMatch = src.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
            if (drivePathMatch) {
              fileId = drivePathMatch[1];
            }
          }
        }

        if (fileId) {
          img.setAttribute('src', `${endpoint}/d/${fileId}?tr=w-800,q-80`);
        }
      });
    }

    return doc.body.innerHTML;
  } catch (err) {
    console.error('Error parsing HTML content in processHtmlContent:', err);
    return content;
  }
};


// Types
type Tab = 'Beranda' | 'Jadwal Keluarga' | 'Galeri' | 'Pengurus' | 'Data Anggota' | 'Login' | 'APanel';

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
  // --- Ditambahkan untuk A.Panel (kustomisasi tampilan oleh admin) ---
  primaryColor?: string;     // warna aksen utama (judul header, border, dll)
  secondaryColor?: string;   // warna aksen sekunder (hover menu, underline aktif)
  navBgColor?: string;       // warna latar belakang navbar
  navTextColor?: string;     // warna teks/list menu navbar
  siteBgColor?: string;      // warna latar belakang seluruh halaman
  headerFontFamily?: string;
  headerFontSize?: string;
  headerBgImage?: string;    // gambar latar belakang header (opsional)
  headerBgOverlay?: string;  // overlay gelap di atas gambar header supaya judul tetap terbaca
  navFontFamily?: string;
  navFontSize?: string;
  navFontWeight?: string;
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
  tempatLahir?: string;
  tanggalLahir?: string;
}

type UmatSortOption = 'nama-az' | 'nama-za' | 'tanggal-terbaru' | 'tanggal-terlama';

// id anggota dibuat dari Date.now() (atau "pending_"+Date.now() untuk yang masih pending),
// jadi bisa dipakai juga sebagai penanda urutan waktu input tanpa perlu field tambahan.
const getUmatTimestamp = (u: UmatRecord): number => {
  const raw = u.id.replace('pending_', '');
  const ts = parseInt(raw, 10);
  return isNaN(ts) ? 0 : ts;
};

const sortUmatList = (list: UmatRecord[], sortBy: UmatSortOption): UmatRecord[] => {
  const sorted = [...list];
  if (sortBy === 'nama-az') sorted.sort((a, b) => a.nama.localeCompare(b.nama, 'id'));
  else if (sortBy === 'nama-za') sorted.sort((a, b) => b.nama.localeCompare(a.nama, 'id'));
  else if (sortBy === 'tanggal-terbaru') sorted.sort((a, b) => getUmatTimestamp(b) - getUmatTimestamp(a));
  else if (sortBy === 'tanggal-terlama') sorted.sort((a, b) => getUmatTimestamp(a) - getUmatTimestamp(b));
  return sorted;
};

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

const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyaEatvxMhJfwQROL-esMFIQJZ9jAEFf1P7ixTlN0wYgdpL3ow27JmSd6E1dk892B2DYw/exec';

const DEFAULT_CONTENT: FullContent = {
  settings: {
    logo: "/LOGO_KARO.jpg",
    title: "IMKKSA Banda Aceh Sekitar",
    primaryColor: '#2e7d32',
    secondaryColor: '#8bc34a',
    navBgColor: '#2f5d50',
    navTextColor: '#ffffff',
    siteBgColor: '#f4f8f4',
    headerFontFamily: "'Playfair Display', serif",
    headerFontSize: 'clamp(1.8rem, 6vw, 3.2rem)',
    headerBgImage: '',
    headerBgOverlay: 'rgba(0, 0, 0, 0.25)',
    navFontFamily: "'Inter', sans-serif",
    navFontSize: '1rem',
    navFontWeight: '500',
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

// ── Helper: baca file jadi base64 & upload ke Google Drive ──
// (dipakai di handleFileChange dan saat migrasi data lama)
const readFileAsBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

const uploadBase64ToDrive = async (base64: string, folder?: string): Promise<string> => {
  const res = await fetch(SCRIPT_URL, {
    method: 'POST',
    mode: 'cors',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({
      action: 'uploadImage',
      data: { base64, ...(folder ? { folder } : {}) }
    })
  });
  const result = await res.json();
  if (result.success && result.url) return result.url;
  throw new Error(result.error || 'Upload gagal, tidak ada URL yang dikembalikan.');
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
    nama: '', status: 'Anggota', nik: '', alamat: '', noHp: '', photo: '', kk: '', tempatLahir: '', tanggalLahir: ''
  })
  const [editingId, setEditingId] = useState<string | null>(null)
  // Mode input KK khusus form admin: 'upload' file baru, 'link' tempel link manual,
  // 'sama' pakai KK milik anggota lain yang sudah ada (mis. kepala keluarga)
  const [kkMode, setKkMode] = useState<'upload' | 'link' | 'sama'>('upload')
  // Urutan tampil tabel "Daftar Anggota Resmi" di admin
  const [adminSortBy, setAdminSortBy] = useState<UmatSortOption>('nama-az')
  // Tampilan publik (non-login): daftar baru muncul setelah cari atau klik "Tampilkan Semua"
  const [userShowAll, setUserShowAll] = useState(false)
  const [userSortBy, setUserSortBy] = useState<UmatSortOption>('nama-az')

  // Non-Admin data anggota flow
  const [showUserForm, setShowUserForm] = useState(false)
  const [userUmatForm, setUserUmatForm] = useState<Omit<UmatRecord, 'id' | 'isPending'>>({
    nama: '', status: 'Anggota', nik: '', alamat: '', noHp: '', photo: '', kk: '', tempatLahir: '', tanggalLahir: ''
  })
  const [userSubmitMessage, setUserSubmitMessage] = useState<string | null>(null)
  const [isSubmittingUserForm, setIsSubmittingUserForm] = useState(false)
  const [selectedUmat, setSelectedUmat] = useState<UmatRecord | null>(null)
  // Field foto/KK yang sedang diunggah ke Google Drive (form admin atau publik)
  const [uploadingField, setUploadingField] = useState<null | { form: 'admin' | 'user'; field: 'photo' | 'kk' }>(null)

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
          let currentParsedPengurus = data.pengurus !== undefined ? data.pengurus : prev.pengurus;
          if (data.settings && data.settings.pengurusRaw) {
            try {
              const parsedRaw = JSON.parse(data.settings.pengurusRaw);
              if (Array.isArray(parsedRaw) && parsedRaw.length > 0 && (!currentParsedPengurus || currentParsedPengurus.length === 0)) {
                currentParsedPengurus = parsedRaw;
              }
            } catch (e) {
              console.error("Gagal parse pengurusRaw:", e);
            }
          }

          const mergedContent = {
            ...prev,
            settings: data.settings ? { ...DEFAULT_CONTENT.settings, ...data.settings } : prev.settings,
            pages: data.pages ? { ...DEFAULT_CONTENT.pages, ...migratedPages } : prev.pages,
            // umat kini sumber datanya Supabase (dikelola loadUmat terpisah)
            umat: prev.umat,
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

  // Ref agar polling bisa membaca status login terbaru tanpa restart effect
  const isLoggedInRef = useRef(isLoggedIn)
  useEffect(() => {
    isLoggedInRef.current = isLoggedIn
  }, [isLoggedIn])

  // ── Data anggota (umat) — sumber utama: Supabase ──
  // siteContentRef dipakai agar loadUmat bisa membaca data terbaru tanpa
  // perlu di-recreate tiap render.
  const siteContentRef = useRef(siteContent)
  useEffect(() => {
    siteContentRef.current = siteContent
  }, [siteContent])

  // Muat data anggota dari Supabase:
  //  - Admin → semua baris (termasuk pending, NIK, KK)
  //  - Publik → hanya yang disetujui, tanpa NIK/KK
  //  - Jika Supabase masih kosong & ada data lama di Apps Script/localStorage
  //    → migrasi SEKALI ke Supabase (termasuk upload base64 yang tersisa ke Drive)
  const loadUmat = useCallback(async (opts: { silent?: boolean } = {}) => {
    try {
      if (isLoggedInRef.current) {
        const all = await umatService.fetchAll()
        if (all.length > 0) {
          setSiteContent(prev => {
            const next = { ...prev, umat: all }
            localStorage.setItem('imkksaSiteContent', JSON.stringify(next))
            return next
          })
          return
        }

        // Supabase masih kosong → ambil data lama dari localStorage/Apps Script
        let existing = [...(siteContentRef.current.umat || [])]
        if (existing.length === 0) {
          try {
            const res = await fetch(`${SCRIPT_URL}?t=${Date.now()}`, { method: 'GET', mode: 'cors', redirect: 'follow' })
            const text = await res.text()
            const data = JSON.parse(text.replace(/^\uFEFF/, '').trim())
            if (Array.isArray(data.umat)) existing = data.umat
          } catch (e) {
            console.error('Gagal mengambil data lama dari Apps Script:', e)
          }
        }

        if (existing.length > 0) {
          // Bersihkan base64 yang tersisa → upload ke Drive, simpan URL-nya
          const cleaned: UmatRecord[] = []
          for (const u of existing) {
            let photo = u.photo
            let kk = u.kk
            if (photo && photo.startsWith('data:')) {
              try { photo = await uploadBase64ToDrive(photo, 'IMKKSA_Anggota_Dokumen') } catch (e) { console.error('Gagal migrasi foto:', e) }
            }
            if (kk && kk.startsWith('data:')) {
              try { kk = await uploadBase64ToDrive(kk, 'IMKKSA_Anggota_Dokumen') } catch (e) { console.error('Gagal migrasi KK:', e) }
            }
            cleaned.push({ ...u, photo, kk })
          }
          await umatService.upsert(cleaned)
          const fresh = await umatService.fetchAll()
          if (fresh.length > 0) {
            setSiteContent(prev => {
              const next = { ...prev, umat: fresh }
              localStorage.setItem('imkksaSiteContent', JSON.stringify(next))
              return next
            })
            alert('✅ Data anggota lama berhasil dimigrasikan ke Supabase!')
          }
        }
      } else {
        const approved = await umatService.fetchApproved('')
        setSiteContent(prev => {
          const next = { ...prev, umat: approved }
          localStorage.setItem('imkksaSiteContent', JSON.stringify(next))
          return next
        })
      }
    } catch (err) {
      if (!opts.silent) console.error('Gagal memuat data anggota dari Supabase:', err)
    }
  }, [])

  // Muat ulang umat dari Supabase saat halaman dibuka & saat status login berubah.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- pemuatan data async via fetch (pola fetch-on-mount standar React)
    loadUmat()
  }, [loadUmat, isLoggedIn])

  // Pengambilan data: sekali saat halaman dibuka + refresh saat tab kembali aktif.
  // Polling berkala (60 detik, bukan 15 detik) HANYA untuk admin yang sedang login
  // dan HANYA saat tab terlihat → kuota Apps Script hemat & situs tetap cepat
  // meski data anggota (umat) sudah 60+ keluarga.
  useEffect(() => {
    fetchData()

    const POLL_INTERVAL_MS = 60000
    let intervalId: ReturnType<typeof setInterval> | null = null

    const startPolling = () => {
      if (intervalId !== null) return
      intervalId = setInterval(() => {
        if (document.visibilityState === 'visible' && isLoggedInRef.current) {
          fetchData(true)
        }
      }, POLL_INTERVAL_MS)
    }
    const stopPolling = () => {
      if (intervalId !== null) {
        clearInterval(intervalId)
        intervalId = null
      }
    }
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        fetchData(true) // segarkan data segera saat kembali ke tab
        loadUmat({ silent: true }) // segarkan juga data anggota dari Supabase
        startPolling()
      } else {
        stopPolling()
      }
    }

    document.addEventListener('visibilitychange', handleVisibility)
    if (document.visibilityState === 'visible') startPolling()

    return () => {
      stopPolling()
      document.removeEventListener('visibilitychange', handleVisibility)
    }
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

  // Auto-migrate base64 pengurus photos to Google Drive
  useEffect(() => {
    if (!isLoggedIn || !siteContent.pengurus || siteContent.pengurus.length === 0) return;

    const migrateBase64Photos = async () => {
      let changed = false;
      const updatedPengurus = await Promise.all(
        siteContent.pengurus.map(async (p) => {
          if (p.photo && p.photo.startsWith('data:image')) {
            try {
              console.log(`[Auto-Migration] Mengunggah foto base64 untuk pengurus: ${p.nama}...`);
              const res = await fetch(SCRIPT_URL, {
                method: 'POST',
                mode: 'cors',
                headers: { 'Content-Type': 'text/plain' },
                body: JSON.stringify({
                  action: 'uploadImage',
                  data: { base64: p.photo }
                })
              });
              const result = await res.json();
              if (result.success && result.url) {
                changed = true;
                return { ...p, photo: result.url };
              } else {
                console.error(`Gagal migrasi foto untuk ${p.nama}:`, result.error);
              }
            } catch (err) {
              console.error(`Error migrasi foto untuk ${p.nama}:`, err);
            }
          }
          return p;
        })
      );

      if (changed) {
        const newContent = {
          ...siteContent,
          pengurus: updatedPengurus,
          settings: {
            ...siteContent.settings,
            pengurusRaw: JSON.stringify(updatedPengurus)
          }
        };
        setSiteContent(newContent);
        localStorage.setItem('imkksaSiteContent', JSON.stringify(newContent));
        try {
          await fetch(SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify({ action: 'updateContent', data: newContent }),
          });
          console.log("Berhasil migrasi foto pengurus ke Google Drive & ImageKit!");
          alert("Sistem mendeteksi foto pengurus dalam format Base64 dan telah berhasil memindahkannya secara otomatis ke Google Drive & ImageKit Proxy!");
        } catch (error) {
          console.error("Gagal sinkron pengurus hasil migrasi:", error);
        }
      }
    };

    migrateBase64Photos();
  }, [isLoggedIn, siteContent.pengurus]);

  const handleLogout = () => {
    setIsLoggedIn(false)
    setActiveTab('Beranda')
  }

  const saveChanges = async (updatedData?: any) => {
    setIsSaving(true)
    const finalTitle = updatedData?.title || editTitle
    const finalContent = processHtmlContent(updatedData?.content || editContent)
    const finalSiteTitle = updatedData?.siteTitle || editSiteTitle
    let finalLogo = updatedData?.siteLogo || editLogo

    // Kalau logo masih berupa base64 mentah (baru diupload, belum sempat dipindah),
    // upload dulu ke Google Drive supaya yang disimpan ke Sheets cuma link pendek,
    // bukan teks base64 yang bisa melebihi batas 50.000 karakter per sel Google Sheets.
    if (finalLogo && finalLogo.startsWith('data:image')) {
      try {
        const res = await fetch(SCRIPT_URL, {
          method: 'POST',
          mode: 'cors',
          headers: { 'Content-Type': 'text/plain' },
          body: JSON.stringify({ action: 'uploadImage', data: { base64: finalLogo } })
        });
        const result = await res.json();
        if (result.success && result.url) {
          finalLogo = result.url;
          setEditLogo(result.url);
        } else {
          console.error('Gagal upload logo ke Google Drive:', result.error);
          alert('Gagal mengupload logo ke Google Drive. Perubahan lain tetap disimpan, tapi logo tidak berubah.');
          finalLogo = siteContent.settings.logo; // fallback ke logo lama, jangan kirim base64 mentah
        }
      } catch (err) {
        console.error('Error upload logo:', err);
        alert('Gagal mengupload logo (koneksi bermasalah). Perubahan lain tetap disimpan, tapi logo tidak berubah.');
        finalLogo = siteContent.settings.logo;
      }
    }

    const newContent = {
      ...siteContent,
      settings: {
        ...siteContent.settings, // PERBAIKAN: pertahankan pengaturan tema (warna/font) dari A.Panel
        logo: finalLogo,
        title: finalSiteTitle,
        pengurusRaw: JSON.stringify(siteContent.pengurus || [])
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

  // Dipakai khusus oleh A.Panel untuk menyimpan pengaturan tema (warna, font, dll).
  // Terpisah dari saveChanges() supaya tidak ikut memicu logika simpan halaman/PDF.
  const handleSaveThemeSettings = async (newSettings: SiteSettings) => {
    setIsSaving(true)
    const newContent: FullContent = {
      ...siteContent,
      settings: {
        ...siteContent.settings,
        ...newSettings,
        pengurusRaw: JSON.stringify(siteContent.pengurus || []),
      },
    }

    setSiteContent(newContent)
    localStorage.setItem('imkksaSiteContent', JSON.stringify(newContent))

    try {
      const payload = JSON.stringify({ action: 'updateContent', data: newContent })
      await fetch(SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain' },
        body: payload,
      })
    } catch (error) {
      console.error('Gagal menyimpan tema ke Google Drive:', error)
      throw error
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
    let changedRecord: UmatRecord;
    if (editingId) {
      // Edit mode: replace the existing record
      changedRecord = { ...umatForm, id: editingId, isPending: false };
      newUmatList = newUmatList.map(u =>
        u.id === editingId ? changedRecord : u
      );
    } else {
      // Add mode: check if name already exists to avoid duplication
      const existingRecord = newUmatList.find(u => !u.isPending && u.nama.toLowerCase() === umatForm.nama.trim().toLowerCase());
      if (existingRecord) {
        if (!window.confirm(`Anggota dengan nama "${umatForm.nama}" sudah ada. Apakah Anda ingin memperbarui datanya?`)) {
          return;
        }
        newUmatList = newUmatList.filter(u => u.id !== existingRecord.id);
        // Update-in-place: pakai id record lama supaya tidak meninggalkan baris ganda di Supabase
        changedRecord = { ...umatForm, id: existingRecord.id, isPending: false };
      } else {
        changedRecord = { ...umatForm, id: Date.now().toString(), isPending: false };
      }
      newUmatList.push(changedRecord);
    }

    const newContent = { ...siteContent, umat: newUmatList }
    setSiteContent(newContent)
    localStorage.setItem('imkksaSiteContent', JSON.stringify(newContent))

    try {
      // Simpan langsung ke Supabase (hanya record yang berubah → payload kecil & cepat)
      await umatService.upsert([changedRecord])
      alert('Data Anggota Berhasil Disimpan ke Supabase!')
    } catch (error) {
      console.error("Gagal simpan data anggota ke Supabase:", error)
      alert('Gagal menyimpan ke Supabase: ' + (error instanceof Error ? error.message : String(error)))
    }
    setUmatForm({ nama: '', status: 'Anggota', nik: '', alamat: '', noHp: '', photo: '', kk: '', tempatLahir: '', tanggalLahir: '' })
    setEditingId(null)
    setKkMode('upload')
    setAdminSearch('')
  }

  const handleDeleteUmat = async (id: string, name: string) => {
    if (window.confirm(`Apakah Anda yakin ingin menghapus data anggota: ${name}?`)) {
      const newUmatList = siteContent.umat.filter(u => u.id !== id);
      const newContent = { ...siteContent, umat: newUmatList };
      setSiteContent(newContent);
      localStorage.setItem('imkksaSiteContent', JSON.stringify(newContent));

      try {
        await umatService.remove(id);
        alert('Data Anggota Berhasil Dihapus!');
      } catch (error) {
        console.error("Gagal menghapus data anggota:", error);
      }

      if (editingId === id) {
        setUmatForm({ nama: '', status: 'Anggota', nik: '', alamat: '', noHp: '', photo: '', kk: '', tempatLahir: '', tanggalLahir: '' });
        setEditingId(null);
        setKkMode('upload');
      }
    }
  }

  const handleApproveUmat = async (umat: UmatRecord) => {
    // Hapus hanya yang id-nya sama (jangan filter by nama agar tidak memengaruhi
    // orang berbeda yang kebetulan bernama sama / meninggalkan baris ganda).
    const cleanList = siteContent.umat.filter(u => u.id !== umat.id);
    const officialUmat = { ...umat, isPending: false };
    const newUmatList = [...cleanList, officialUmat];

    const newContent = { ...siteContent, umat: newUmatList };
    setSiteContent(newContent);
    localStorage.setItem('imkksaSiteContent', JSON.stringify(newContent));

    try {
      await umatService.upsert([officialUmat])
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
      await umatService.remove(id);
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
      await umatService.upsert([pendingRecord]);
      setUserSubmitMessage('Data berhasil dikirim! Menunggu verifikasi Admin.');
    } catch {
      setUserSubmitMessage('Gagal terkirim ke server. Data tersimpan lokal, silakan coba lagi nanti.');
    } finally {
      setIsSubmittingUserForm(false);
      setShowUserForm(false);
      setUserUmatForm({ nama: '', status: 'Anggota', nik: '', alamat: '', noHp: '', photo: '', kk: '', tempatLahir: '', tanggalLahir: '' });
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
    
    let photoUrl = pengurusForm.photo || '';
    
    // Jika foto adalah base64 data, upload ke Google Drive terlebih dahulu
    if (photoUrl && photoUrl.startsWith('data:image')) {
      try {
        const res = await fetch(SCRIPT_URL, {
          method: 'POST',
          mode: 'cors',
          headers: { 'Content-Type': 'text/plain' },
          body: JSON.stringify({
            action: 'uploadImage',
            data: { base64: photoUrl }
          })
        });
        const result = await res.json();
        if (result.success && result.url) {
          photoUrl = result.url;
        } else {
          console.error("Gagal unggah foto pengurus ke Drive:", result.error);
          alert("Gagal mengunggah foto pengurus ke Google Drive: " + (result.error || "Error tidak diketahui"));
          return;
        }
      } catch (err) {
        console.error("Error upload foto pengurus:", err);
        alert("Gagal mengunggah foto pengurus: " + (err instanceof Error ? err.message : String(err)));
        return;
      }
    }

    const newPengurus: PengurusRecord = { 
      ...pengurusForm, 
      photo: photoUrl, 
      id: Date.now().toString() 
    };
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

  // Upload foto/KK LANGSUNG ke Google Drive saat file dipilih (bukan saat tombol
  // Simpan ditekan). Form hanya menyimpan URL-nya, sehingga payload simpan kecil,
  // cepat, dan tidak lagi mengirim base64 besar lewat Apps Script (mencegah
  // timeout 6 menit & melebihi batas Script Properties 500KB).
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, field: 'photo' | 'kk', isAdmin = true) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert("Ukuran file tidak boleh lebih dari 5 MB");
      e.target.value = '';
      return;
    }

    const formKey = isAdmin ? 'admin' : 'user';
    if (uploadingField?.form === formKey && uploadingField?.field === field) return;
    setUploadingField({ form: formKey, field });

    try {
      const base64 = await readFileAsBase64(file);
      // Pas foto cukup 500px; KK perlu lebih besar supaya tetap terbaca jelas.
      const maxWidth = field === 'kk' ? 800 : 500;
      const compressed = await compressImage(base64, maxWidth, 0.6);
      const url = await uploadBase64ToDrive(compressed, 'IMKKSA_Anggota_Dokumen');
      if (isAdmin) {
        setUmatForm(prev => ({ ...prev, [field]: url }));
      } else {
        setUserUmatForm(prev => ({ ...prev, [field]: url }));
      }
    } catch (err) {
      console.error(`Gagal unggah ${field}:`, err);
      const label = field === 'photo' ? 'Pas Foto' : 'Kartu Keluarga';
      alert(`Gagal mengunggah ${label} ke Google Drive: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setUploadingField(null);
      e.target.value = '';
    }
  }

  const renderDataAnggota = () => {
    const pendingUmat = siteContent.umat.filter(u => u.isPending);
    const approvedUmat = siteContent.umat.filter(u => !u.isPending);
    const filteredAdminUmat = sortUmatList(
      adminSearch
        ? approvedUmat.filter(u => u.nama.toLowerCase().includes(adminSearch.toLowerCase()))
        : approvedUmat,
      adminSortBy
    );

    // Tabel publik sengaja kosong sebelum user mencari atau klik "Tampilkan Semua"
    const userHasQueried = !!userSearchQuery || userShowAll;
    const filteredUserUmat = userHasQueried
      ? sortUmatList(
          approvedUmat.filter(u => u.nama.toLowerCase().includes(userSearchQuery.toLowerCase())),
          userSortBy
        )
      : [];

    // --- Export Data Anggota ke Excel (.xlsx) ---
    const handleExportExcel = () => {
      if (filteredAdminUmat.length === 0) {
        alert('Tidak ada data anggota untuk diunduh.');
        return;
      }
      const dataToExport = filteredAdminUmat.map((u, idx) => ({
        No: idx + 1,
        'Nama Lengkap': u.nama,
        'NIK / No. KTP': u.nik || '-',
        'Tempat Lahir': u.tempatLahir || '-',
        'Tanggal Lahir': formatDateDevice(u.tanggalLahir),
        'Alamat Lengkap': u.alamat || '-',
        'No. HP / WA': u.noHp || '-',
        'Status Keanggotaan': u.status,
      }));

      const ws = XLSX.utils.json_to_sheet(dataToExport);
      ws['!cols'] = [
        { wch: 5 },  // No
        { wch: 25 }, // Nama
        { wch: 20 }, // NIK
        { wch: 18 }, // Tempat Lahir
        { wch: 18 }, // Tanggal Lahir
        { wch: 35 }, // Alamat
        { wch: 16 }, // No HP
        { wch: 16 }, // Status
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Data Anggota');

      const tanggal = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(wb, `Data_Anggota_IMKKSA_${tanggal}.xlsx`);
    };

    // --- Export Data Anggota ke PDF ---
    const handleExportPDF = () => {
      if (filteredAdminUmat.length === 0) {
        alert('Tidak ada data anggota untuk diunduh.');
        return;
      }
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

      doc.setFontSize(13);
      doc.setFont(undefined, 'bold');
      doc.text('DAFTAR ANGGOTA IMKKSA BANDA ACEH SEKITAR', 14, 15);
      doc.setFont(undefined, 'normal');
      doc.setFontSize(9);
      const tanggalCetak = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
      doc.text(`Dicetak pada: ${tanggalCetak}  |  Total Anggota: ${filteredAdminUmat.length}`, 14, 21);

      const tableRows = filteredAdminUmat.map((u, idx) => [
        idx + 1,
        u.nama,
        u.nik || '-',
        formatDateDevice(u.tanggalLahir),
        u.alamat || '-',
        u.noHp || '-',
        u.status,
      ]);

      autoTable(doc, {
        startY: 26,
        head: [['No', 'Nama Lengkap', 'NIK / No. KTP', 'Tgl Lahir', 'Alamat Lengkap', 'No. HP/WA', 'Status']],
        body: tableRows,
        styles: { fontSize: 7.5, cellPadding: 2, valign: 'middle' },
        headStyles: { fillColor: [46, 125, 50], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [244, 248, 244] },
        columnStyles: {
          0: { cellWidth: 8 },
          1: { cellWidth: 40 },
          2: { cellWidth: 30 },
          3: { cellWidth: 25 },
          4: { cellWidth: 70 },
          5: { cellWidth: 28 },
          6: { cellWidth: 22 },
        },
      });

      const tanggal = new Date().toISOString().slice(0, 10);
      doc.save(`Data_Anggota_IMKKSA_${tanggal}.pdf`);
    };

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
                <div className="form-group">
                  <label>Tempat Lahir:</label>
                  <input type="text" value={umatForm.tempatLahir || ''} onChange={e => setUmatForm({ ...umatForm, tempatLahir: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Tanggal Lahir:</label>
                  <input type="date" value={umatForm.tanggalLahir || ''} onChange={e => setUmatForm({ ...umatForm, tanggalLahir: e.target.value })} />
                </div>
                <div className="form-group full-width">
                  <label>Alamat:</label>
                  <textarea value={umatForm.alamat} onChange={e => setUmatForm({ ...umatForm, alamat: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Upload Pas Foto (Opsional, Maksimal 5 MB):</label>
                  <>
                    <input type="file" accept="image/*" onChange={(e) => handleFileChange(e, 'photo', true)} disabled={uploadingField?.form === 'admin' && uploadingField?.field === 'photo'} />
                    {uploadingField?.form === 'admin' && uploadingField?.field === 'photo' && (
                      <div className="upload-status">⏳ Mengunggah pas foto ke Google Drive...</div>
                    )}
                  </>
                  {umatForm.photo && (
                    <div className="preview-container">
                      <img
                        src={toImageKitUrl(umatForm.photo, 400)}
                        alt="Preview Foto"
                        className="file-preview-img"
                        style={{ objectFit: 'cover', objectPosition: 'top center' }}
                      />
                      <button type="button" className="btn-remove-file" onClick={() => setUmatForm({ ...umatForm, photo: '' })}>Hapus Foto</button>
                    </div>
                  )}
                </div>
                <div className="form-group">
                  <label>Kartu Keluarga (KK - Opsional, Maksimal 5 MB):</label>
                  <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '8px' }}>
                    <label style={{ fontWeight: 400, display: 'inline-flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
                      <input type="radio" name="kkMode" checked={kkMode === 'upload'} onChange={() => setKkMode('upload')} />
                      Upload File
                    </label>
                    <label style={{ fontWeight: 400, display: 'inline-flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
                      <input type="radio" name="kkMode" checked={kkMode === 'link'} onChange={() => setKkMode('link')} />
                      Link Manual
                    </label>
                    <label style={{ fontWeight: 400, display: 'inline-flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
                      <input type="radio" name="kkMode" checked={kkMode === 'sama'} onChange={() => setKkMode('sama')} />
                      Sama dengan Kepala Keluarga
                    </label>
                  </div>

                  {kkMode === 'upload' && (
                    <>
                      <input type="file" accept="image/*" onChange={(e) => handleFileChange(e, 'kk', true)} disabled={uploadingField?.form === 'admin' && uploadingField?.field === 'kk'} />
                      {uploadingField?.form === 'admin' && uploadingField?.field === 'kk' && (
                        <div className="upload-status">⏳ Mengunggah Kartu Keluarga ke Google Drive...</div>
                      )}
                    </>
                  )}

                  {kkMode === 'link' && (
                    <input
                      type="text"
                      placeholder="Tempel link KK di sini (mis. link Google Drive)"
                      value={umatForm.kk}
                      onChange={(e) => setUmatForm({ ...umatForm, kk: e.target.value })}
                      style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ddd' }}
                    />
                  )}

                  {kkMode === 'sama' && (
                    <select
                      value=""
                      onChange={(e) => {
                        const chosen = approvedUmat.find(u => u.id === e.target.value);
                        if (chosen && chosen.kk) {
                          setUmatForm({ ...umatForm, kk: chosen.kk });
                        }
                      }}
                      style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ddd' }}
                    >
                      <option value="">-- Pilih Kepala Keluarga --</option>
                      {approvedUmat.filter(u => u.kk).map(u => (
                        <option key={u.id} value={u.id}>{u.nama}</option>
                      ))}
                    </select>
                  )}

                  {umatForm.kk && (
                    <div className="preview-container">
                      {kkMode === 'link' ? (
                        <p style={{ fontSize: '0.85rem', wordBreak: 'break-all', color: '#555' }}>Link tersimpan: {umatForm.kk}</p>
                      ) : (
                        <img src={toImageKitUrl(umatForm.kk, 400)} alt="Preview KK" className="file-preview-img" />
                      )}
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
                        setUmatForm({ nama: '', status: 'Anggota', nik: '', alamat: '', noHp: '', photo: '', kk: '', tempatLahir: '', tanggalLahir: '' });
                        setEditingId(null);
                        setKkMode('upload');
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
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', flexWrap: 'wrap', gap: '10px' }}>
                <h3>Daftar Anggota Resmi ({approvedUmat.length})</h3>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="btn-edit-small"
                    onClick={handleExportExcel}
                    style={{ background: '#e8f5e9', color: '#1b5e20', border: '1px solid #a5d6a7', display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    📊 Unduh Excel
                  </button>
                  <button
                    type="button"
                    className="btn-edit-small"
                    onClick={handleExportPDF}
                    style={{ background: '#ffebee', color: '#b71c1c', border: '1px solid #ffcdd2', display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    📄 Unduh PDF
                  </button>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '15px' }}>
                <input type="text" placeholder="Cari Anggota Resmi..." value={adminSearch} onChange={e => setAdminSearch(e.target.value)} style={{ flex: 1, minWidth: '200px', padding: '10px', borderRadius: '8px', border: '1px solid #ddd' }} />
                <select value={adminSortBy} onChange={e => setAdminSortBy(e.target.value as UmatSortOption)} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ddd' }}>
                  <option value="nama-az">Nama (A-Z)</option>
                  <option value="nama-za">Nama (Z-A)</option>
                  <option value="tanggal-terbaru">Tanggal Input (Terbaru)</option>
                  <option value="tanggal-terlama">Tanggal Input (Terlama)</option>
                </select>
              </div>
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
                            <button className="btn-edit-small" onClick={() => { setUmatForm({ nama: u.nama, status: u.status, nik: u.nik, alamat: u.alamat, noHp: u.noHp, photo: u.photo, kk: u.kk, tempatLahir: u.tempatLahir || '', tanggalLahir: u.tanggalLahir || '' }); setEditingId(u.id); setKkMode('upload'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>Edit</button>
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
                              <button className="btn-edit-small" onClick={() => { setUmatForm({ nama: u.nama, status: u.status || 'Anggota', nik: u.nik, alamat: u.alamat, noHp: u.noHp, photo: u.photo, kk: u.kk, tempatLahir: u.tempatLahir || '', tanggalLahir: u.tanggalLahir || '' }); setEditingId(u.id); setKkMode('upload'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>Edit</button>
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
            <div className="user-search-container" style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
              <input 
                type="text" 
                placeholder="Cari Nama Anggota..." 
                value={userSearch} 
                onChange={e => setUserSearch(e.target.value)} 
                onKeyDown={e => { if (e.key === 'Enter') handleUserSearch(); }}
                style={{ flex: 1, minWidth: '180px', padding: '12px', borderRadius: '8px', border: '1px solid #ddd' }} 
              />
              <button className="btn-save" onClick={handleUserSearch} style={{ padding: '0 30px' }}>CARI</button>
              <button
                className="btn-save"
                onClick={() => { setUserSearch(''); setUserSearchQuery(''); setUserShowAll(true); }}
                style={{ padding: '0 20px', background: '#546e7a' }}
              >
                TAMPILKAN SEMUA
              </button>
              {userHasQueried && (
                <select value={userSortBy} onChange={e => setUserSortBy(e.target.value as UmatSortOption)} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ddd' }}>
                  <option value="nama-az">Nama (A-Z)</option>
                  <option value="nama-za">Nama (Z-A)</option>
                  <option value="tanggal-terbaru">Tanggal Input (Terbaru)</option>
                  <option value="tanggal-terlama">Tanggal Input (Terlama)</option>
                </select>
              )}
              {userHasQueried && (
                <button 
                  className="btn-edit-small" 
                  onClick={() => { setUserSearch(''); setUserSearchQuery(''); setUserShowAll(false); }}
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
                          {userHasQueried ? 'Data Anggota Tidak Ditemukan' : 'Klik "TAMPILKAN SEMUA" atau cari nama untuk melihat daftar anggota.'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {userHasQueried && filteredUserUmat.length === 0 && (
                <div style={{ textAlign: 'center', marginTop: '20px', marginBottom: '20px' }}>
                  <p style={{ color: '#666', fontSize: '0.9rem', marginBottom: '15px' }}>
                    Nama Anda belum terdaftar? Silakan isi data secara mandiri untuk mendaftar.
                  </p>
                  <button 
                    className="btn-save" 
                    onClick={() => { 
                      setUserUmatForm({ nama: '', status: 'Anggota', nik: '', alamat: '', noHp: '', photo: '', kk: '', tempatLahir: '', tanggalLahir: '' }); 
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
                      <label>Tempat Lahir (Opsional):</label>
                      <input 
                        type="text" 
                        value={userUmatForm.tempatLahir || ''} 
                        onChange={e => setUserUmatForm({ ...userUmatForm, tempatLahir: e.target.value })} 
                        placeholder="Kota atau Kabupaten tempat Anda lahir"
                      />
                    </div>
                    <div className="form-group">
                      <label>Tanggal Lahir (Opsional):</label>
                      <input 
                        type="date" 
                        value={userUmatForm.tanggalLahir || ''} 
                        onChange={e => setUserUmatForm({ ...userUmatForm, tanggalLahir: e.target.value })} 
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
                      <>
                        <input 
                          type="file" 
                          accept="image/*" 
                          onChange={(e) => handleFileChange(e, 'photo', false)} 
                          disabled={uploadingField?.form === 'user' && uploadingField?.field === 'photo'}
                        />
                        {uploadingField?.form === 'user' && uploadingField?.field === 'photo' && (
                          <div className="upload-status">⏳ Mengunggah pas foto ke Google Drive...</div>
                        )}
                      </>
                      {userUmatForm.photo && (
                        <div className="preview-container">
                          <img
                            src={toImageKitUrl(userUmatForm.photo, 400)}
                            alt="Preview Foto"
                            className="file-preview-img"
                            style={{ objectFit: 'cover', objectPosition: 'top center' }}
                          />
                          <button type="button" className="btn-remove-file" onClick={() => setUserUmatForm({ ...userUmatForm, photo: '' })}>Hapus Foto</button>
                        </div>
                      )}
                    </div>
                    <div className="form-group">
                      <label>Upload KK (Kartu Keluarga - Opsional, Maksimal 5 MB):</label>
                      <>
                        <input 
                          type="file" 
                          accept="image/*" 
                          onChange={(e) => handleFileChange(e, 'kk', false)} 
                          disabled={uploadingField?.form === 'user' && uploadingField?.field === 'kk'}
                        />
                        {uploadingField?.form === 'user' && uploadingField?.field === 'kk' && (
                          <div className="upload-status">⏳ Mengunggah Kartu Keluarga ke Google Drive...</div>
                        )}
                      </>
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
                {p.photo && <img src={toImageKitUrl(p.photo, 400, true)} alt={p.nama} className="pengurus-photo" />}
                <h3>{p.jabatan}</h3><p>{p.nama}</p>
              </div>
            ))}
          </div>
        </div>
      )
    } else {
      return (
        <div className="page-content">
          <h2>Daftar Pengurus</h2>
          <div className="pengurus-grid">
            {pengurusList.map(p => (
              <div key={p.id} className="pengurus-card">
                {p.photo && <img src={toImageKitUrl(p.photo, 400, true)} alt={p.nama} className="pengurus-photo" />}
                <h3>{p.jabatan}</h3><p>{p.nama}</p>
              </div>
            ))}
          </div>

          <h2 style={{ marginTop: '40px' }}>Kelola Pengurus</h2>
          <div className="form-section">
            <label>Jabatan</label>
            <select value={pengurusForm.jabatan} onChange={e => setPengurusForm({ ...pengurusForm, jabatan: e.target.value })}>
              <option value="Ketua">Ketua</option><option value="Wakil Ketua">Wakil Ketua</option><option value="Sekretaris">Sekretaris</option><option value="Wakil Sekretaris">Wakil Sekretaris</option><option value="Bendahara">Bendahara</option><option value="Wakil Bendahara">Wakil Bendahara</option>
            </select>
            <label>Nama</label><input type="text" value={pengurusForm.nama} onChange={e => setPengurusForm({ ...pengurusForm, nama: e.target.value })} />
            <label>Foto</label><input type="file" accept="image/*" onChange={handlePengurusPhoto} />
            {pengurusForm.photo && (
              <div className="preview-container">
                <img src={toImageKitUrl(pengurusForm.photo, 200, true)} alt="Preview Foto" className="file-preview-img" />
                <button type="button" className="btn-remove-file" onClick={() => setPengurusForm({ ...pengurusForm, photo: '' })}>Hapus Foto</button>
              </div>
            )}
            <button className="btn-save" onClick={handleSavePengurus}>Simpan Pengurus</button>
          </div>
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
    if (activeTab === 'APanel') {
      if (!isLoggedIn) return null
      return (
        <APanel
          settings={siteContent.settings}
          onSaveSettings={handleSaveThemeSettings}
          onLogout={handleLogout}
          scriptUrl={SCRIPT_URL}
        />
      )
    }

    // Beranda & Jadwal Keluarga — konten halaman saja, tanpa PDF
    const currentPage = siteContent.pages[activeTab]
    if (!currentPage) return null

    // Helper untuk mengubah Google Drive link di HTML content menjadi ImageKit CDN proxy
    const renderContentHtml = (htmlContent: string) => {
      const content = processHtmlContent(htmlContent);
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
            onSave={(data: any) => { setEditTitle(data.title || ''); setEditContent(processHtmlContent(data.content || '')); setEditSiteTitle(data.siteTitle || ''); setEditLogo(data.siteLogo || ''); }}
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
                <p>Sekretariat: Banda Aceh, Prov. Aceh | Email: imkksabandaaceh@gmail.com</p>
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
                      <td className="label-cell">Tempat Lahir</td>
                      <td className="value-cell">: {selectedUmat.tempatLahir || '-'}</td>
                    </tr>
                    <tr>
                      <td className="label-cell">Tanggal Lahir</td>
                      <td className="value-cell">: {selectedUmat.tanggalLahir ? formatDateDevice(selectedUmat.tanggalLahir) : '-'}</td>
                    </tr>
                    <tr>
                      <td className="label-cell">NIK / No. KTP</td>
                      <td className="value-cell">
                        : {selectedUmat.nik ? (isLoggedIn ? selectedUmat.nik : (selectedUmat.nik.length <= 3 ? 'xxx' : selectedUmat.nik.substring(0, selectedUmat.nik.length - 3) + 'xxx')) : '-'}
                      </td>
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
                  <img
                    src={toImageKitUrl(selectedUmat.photo, 400)}
                    alt="Pas Foto"
                    style={{ objectFit: 'cover', objectPosition: 'top center' }}
                  />
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

  // --- Pengaturan tema dari A.Panel diterapkan di sini ---
  const s = siteContent.settings;
  const appContainerStyle: React.CSSProperties = {
    ['--primary-color' as any]: s.primaryColor || '#2e7d32',
    ['--secondary-color' as any]: s.secondaryColor || '#8bc34a',
    ['--nav-bg' as any]: s.navBgColor || '#2f5d50',
    ['--nav-text-color' as any]: s.navTextColor || '#ffffff',
    ['--bg-color' as any]: s.siteBgColor || '#f4f8f4',
    ['--header-font-family' as any]: s.headerFontFamily || "'Playfair Display', serif",
    ['--header-font-size' as any]: s.headerFontSize || 'clamp(1.8rem, 6vw, 3.2rem)',
    ['--nav-font-family' as any]: s.navFontFamily || "'Inter', sans-serif",
    ['--nav-font-size' as any]: s.navFontSize || '1rem',
    ['--nav-font-weight' as any]: s.navFontWeight || '500',
  };

  const headerStyle: React.CSSProperties = s.headerBgImage ? {
    backgroundImage: `linear-gradient(${s.headerBgOverlay || 'rgba(0,0,0,0.25)'}, ${s.headerBgOverlay || 'rgba(0,0,0,0.25)'}), url(${s.headerBgImage})`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
  } : {};

  return (
    <div className="app-container" style={appContainerStyle}>
      <header className="header" style={headerStyle}>
        <div className="logo-container"><img src={siteContent.settings.logo || "/LOGO_KARO.jpg"} alt="Logo IMKKSA" /></div>
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
            <>
              <li
                className={activeTab === 'APanel' ? 'active' : ''}
                onClick={() => setActiveTab('APanel')}
                style={{ color: '#facc15', fontWeight: 700 }}
              >
                ⚙️ A.Panel
              </li>
              <li onClick={handleLogout}>Logout (Admin)</li>
            </>
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
