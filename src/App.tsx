import React, { useState, useEffect } from 'react'
import LoginForm from './components/LoginForm'
import AdminDashboard from './components/AdminDashboard'
import './App.css'

const compressImage = async (
  base64: string,
  _width: number,   // Tambahkan _
  _quality: number  // Tambahkan _
) => {
  return base64
}

// Types
type Tab = 'Beranda' | 'Jadwal Keluarga' | 'Pengurus' | 'Data Anggota' | 'Login';

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
  berandaPdf?: string;
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
  proposals: any[];
  pengurus: PengurusRecord[];
}

const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwnXm-7uc82ZXbcqLVp6wSDmhtelLbods2bHTHEjqov06jzTGf-eCXuXsDnzzGlFDBkTw/exec';

const DEFAULT_CONTENT: FullContent = {
  settings: {
    logo: "/LOGO_KARO.jpg",
    title: "IMKKSA Banda Aceh Sekitar",
    berandaPdf: ""
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
  proposals: [],
  pengurus: []
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
        return {
          ...DEFAULT_CONTENT,
          ...parsed,
          pages: { ...DEFAULT_CONTENT.pages, ...migratedPages },
          proposals: parsed.proposals || []
        }
      } catch (e) {
        return DEFAULT_CONTENT
      }
    }
    return DEFAULT_CONTENT
  })

  const [isLoading, setIsLoading] = useState(true)

  // Editor states
  const [editTitle, setEditTitle] = useState('')
  const [editContent, setEditContent] = useState('')
  const [editLogo, setEditLogo] = useState('')
  const [editSiteTitle, setEditSiteTitle] = useState('')
  const [editBerandaPdf, setEditBerandaPdf] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [showPdfReader, setShowPdfReader] = useState(false)
  const [pengurusForm, setPengurusForm] = useState({
    jabatan: 'Ketua',
    nama: '',
    photo: ''
  })

  // data anggota States
  const [userSearch, setUserSearch] = useState('')
  const [adminSearch, setAdminSearch] = useState('')
  const [umatForm, setUmatForm] = useState<Omit<UmatRecord, 'id' | 'isPending'>>({
    nama: '', status: 'Jemaat', nik: '', alamat: '', noHp: '', photo: '', kk: ''
  })

  // New States for Non-Admin data anggota Flow
  const [userSearchResults, setUserSearchResults] = useState<UmatRecord[]>([])
  const [hasUserSearched, setHasUserSearched] = useState(false)
  const [showUserForm, setShowUserForm] = useState(false)
  const [userUmatForm, setUserUmatForm] = useState<Omit<UmatRecord, 'id' | 'isPending'>>({
    nama: '', status: 'Jemaat', nik: '', alamat: '', noHp: '', photo: '', kk: ''
  })
  const [userSubmitMessage, setUserSubmitMessage] = useState<string | null>(null)
  const [isSubmittingUserForm, setIsSubmittingUserForm] = useState(false)

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  useEffect(() => {
    setIsMobileMenuOpen(false)
  }, [activeTab])

  const fetchData = async (isSilent = false) => {
    if (!isSilent) console.log("Memulai pengambilan data dari Google Drive...");
    try {
      const response = await fetch(`${SCRIPT_URL}?t=${Date.now()}`)
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

      const data = await response.json()
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

        const mergedContent = {
          ...siteContent,
          settings: data.settings ? { ...DEFAULT_CONTENT.settings, ...data.settings } : siteContent.settings,
          pages: data.pages ? { ...DEFAULT_CONTENT.pages, ...migratedPages } : siteContent.pages,
          umat: (data.umat && data.umat.length > 0) ? data.umat : siteContent.umat,
          pengurus: data.pengurus ? data.pengurus : siteContent.pengurus
        }

        setSiteContent(prev => {
          const isSameUmat = JSON.stringify(prev.umat) === JSON.stringify(mergedContent.umat);
          const isSamePages = JSON.stringify(prev.pages) === JSON.stringify(mergedContent.pages);
          const isSameSettings = JSON.stringify(prev.settings) === JSON.stringify(mergedContent.settings);
          const isSamePengurus = JSON.stringify(prev.pengurus) === JSON.stringify(mergedContent.pengurus);

          if (!isSameUmat || !isSamePages || !isSameSettings || !isSamePengurus) {
            localStorage.setItem('imkksaSiteContent', JSON.stringify(mergedContent));
            return mergedContent;
          }
          return prev;
        });
      }
    } catch (error) {
      if (!isSilent) console.error("Gagal mengambil data dari Google Drive:", error)
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
      setEditBerandaPdf(siteContent.settings.berandaPdf || '')
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
    const finalBerandaPdf = updatedData?.berandaPdf || editBerandaPdf

    const newContent = {
      ...siteContent,
      settings: { logo: finalLogo, title: finalSiteTitle, berandaPdf: finalBerandaPdf },
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
    if (!umatForm.nama) {
      alert('Nama Umat harus diisi.')
      return
    }
    const newUmatList = siteContent.umat.filter((u: UmatRecord) => !u.isPending).filter((u: UmatRecord) => u.nama.toLowerCase() !== umatForm.nama.toLowerCase());
    newUmatList.push({ ...umatForm, id: Date.now().toString(), isPending: false });

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
    }
    setUmatForm({ nama: '', status: 'Jemaat', nik: '', alamat: '', noHp: '', photo: '', kk: '' })
    setAdminSearch('')
  }

  const handleDeleteUmat = async (targetNama?: string) => {
    const namaToSearch = targetNama || umatForm.nama
    if (!namaToSearch) return

    if (window.confirm(`Apakah Anda yakin ingin menghapus data anggota: ${namaToSearch}?`)) {
      const newUmatList = siteContent.umat.filter(u => u.nama.toLowerCase() !== namaToSearch.toLowerCase())
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
        alert('Data Anggota Berhasil Dihapus!')
      } catch (error) {
        console.error("Gagal menghapus data anggota:", error)
      }

      if (!targetNama || targetNama.toLowerCase() === umatForm.nama.toLowerCase()) {
        setUmatForm({ nama: '', status: 'Jemaat', nik: '', alamat: '', noHp: '', photo: '', kk: '' })
        setAdminSearch('')
      }
    }
  }

  const handleApproveUmat = async (umat: UmatRecord) => {
    const cleanList = siteContent.umat.filter(u => u.nama.toLowerCase() !== umat.nama.toLowerCase());
    const officialUmat = { ...umat, isPending: false, id: Date.now().toString() };
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
      });
      alert('Data Anggota Berhasil Disimpan & Diverifikasi!');
    } catch (error) {
      console.error("Gagal verifikasi data anggota:", error);
    }
  }

  const handleRejectUmat = async (umatId: string) => {
    if (window.confirm('Apakah Anda yakin ingin menghapus pengajuan revisi mandiri ini?')) {
      const newUmatList = siteContent.umat.filter(u => u.id !== umatId);
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
        alert('Pengajuan Berhasil Dihapus!');
      } catch (error) {
        console.error("Gagal menghapus pengajuan:", error);
      }
    }
  }

  const onEditUmat = (u: UmatRecord) => {
    setUmatForm({
      nama: u.nama, status: u.status, nik: u.nik, alamat: u.alamat, noHp: u.noHp, photo: u.photo, kk: u.kk
    })
    setAdminSearch(u.nama)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const onAdminSearch = (name: string) => {
    setAdminSearch(name)
    const found = siteContent.umat.find(u => !u.isPending && u.nama.toLowerCase() === name.toLowerCase())
    if (found) {
      setUmatForm({
        nama: found.nama, status: found.status, nik: found.nik, alamat: found.alamat, noHp: found.noHp, photo: found.photo, kk: found.kk
      })
    }
  }

  const handleUmatFile = (e: React.ChangeEvent<HTMLInputElement>, field: 'photo' | 'kk') => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert('File terlalu besar! Maksimal ukuran file adalah 5 MB.')
        e.target.value = ''
        return
      }
      const reader = new FileReader()
      reader.onloadend = async () => {
        const base64 = reader.result as string
        const compressed = await compressImage(base64, 800, 0.6)
        setUmatForm({ ...umatForm, [field]: compressed })
      }
      reader.readAsDataURL(file)
    }
  }

  const handlePengurusPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      alert('File terlalu besar! Maksimal 5 MB.')
      e.target.value = ''
      return
    }
    const reader = new FileReader()
    reader.onloadend = async () => {
      const base64 = reader.result as string
      const compressed = await compressImage(base64, 800, 0.6)
      setPengurusForm(prev => ({ ...prev, photo: compressed }))
    }
    reader.readAsDataURL(file)
  }

  const handleSavePengurus = async () => {
    if (!pengurusForm.nama.trim()) {
      alert('Nama Pengurus wajib diisi')
      return
    }
    const pengurusLama = siteContent.pengurus || []
    const pengurusBaru = pengurusLama.filter(p => p.jabatan !== pengurusForm.jabatan)
    pengurusBaru.push({
      id: Date.now().toString(), jabatan: pengurusForm.jabatan, nama: pengurusForm.nama, photo: pengurusForm.photo
    })
    const newContent = { ...siteContent, pengurus: pengurusBaru }
    setSiteContent(newContent)
    localStorage.setItem('imkksaSiteContent', JSON.stringify(newContent))

    try {
      await fetch(SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ action: 'updateContent', data: newContent })
      })
      alert('Data Pengurus berhasil disimpan')
    } catch (error) {
      console.error('Gagal menyimpan pengurus', error)
      alert('Gagal menyimpan data')
    }
  }

  const handleUserSearch = () => {
    if (!userSearch.trim()) return;
    const officialUmat = siteContent.umat.filter(u => !u.isPending);
    const results = officialUmat.filter(u => u.nama.toLowerCase().includes(userSearch.toLowerCase()));
    setUserSearchResults(results);
    setHasUserSearched(true);
    setShowUserForm(false);
    setUserSubmitMessage(null);
  }

  const handleUserFormSubmit = async () => {
    if (!userUmatForm.nama) {
      alert('Nama Umat wajib diisi.');
      return;
    }
    setIsSubmittingUserForm(true);
    try {
      const verificationRecord: UmatRecord = { ...userUmatForm, id: 'verify_' + Date.now(), isPending: true };
      const newUmatList = [...siteContent.umat, verificationRecord];
      const newContent = { ...siteContent, umat: newUmatList };
      setSiteContent(newContent);
      localStorage.setItem('imkksaSiteContent', JSON.stringify(newContent));

      const payload = JSON.stringify({ action: 'updateUmat', data: newContent.umat });
      await fetch(SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain' },
        body: payload
      });
      setUserSubmitMessage('Data berhasil dikirim untuk di verifikasi admin IMKKSA');
      setShowUserForm(false);
      setUserUmatForm({ nama: '', status: 'Jemaat', nik: '', alamat: '', noHp: '', photo: '', kk: '' });
    } catch (error) {
      console.error("Gagal mengirim data verifikasi:", error);
      alert('Gagal mengirim data.');
    } finally {
      setIsSubmittingUserForm(false);
    }
  }

  const renderDataAnggota = () => {
    const officialAnggota = siteContent.umat.filter(u => !u.isPending);
    const pendingAnggota = siteContent.umat.filter(u => u.isPending);
    return (
      <div className="page-card">
        {isLoggedIn ? <h2>Data Anggota & Statistik</h2> : <h2>Data Anggota</h2>}
        {isLoggedIn ? (
          <div className="admin-data-section">
            <div className="admin-data-form">
              <h3>Form Input Data Anggota</h3>
              <div className="form-grid">
                <div className="form-group"><label>Nama Anggota:</label><input type="text" value={umatForm.nama} onChange={e => setUmatForm({ ...umatForm, nama: e.target.value })} /></div>
                <div className="form-group"><label>NIK:</label><input type="text" value={umatForm.nik} onChange={e => setUmatForm({ ...umatForm, nik: e.target.value })} /></div>
                <div className="form-group"><label>No. HP:</label><input type="text" value={umatForm.noHp} onChange={e => setUmatForm({ ...umatForm, noHp: e.target.value })} /></div>
                <div className="form-group full-width"><label>Alamat:</label><textarea value={umatForm.alamat} onChange={e => setUmatForm({ ...umatForm, alamat: e.target.value })} /></div>
                <div className="form-group"><label>Upload Photo (Maksimal 5 MB):</label><input type="file" accept="image/*" onChange={e => handleUmatFile(e, 'photo')} /></div>
                <div className="form-group"><label>Upload KK (Kartu Keluarga - Maksimal 5 MB):</label><input type="file" accept="image/*" onChange={e => handleUmatFile(e, 'kk')} /></div>
              </div>
              <div className="photo-previews">
                {umatForm.photo && <div className="photo-preview-item"><img src={umatForm.photo} alt="Anggota" /><span>Photo</span></div>}
                {umatForm.kk && <div className="photo-preview-item"><img src={umatForm.kk} alt="KK" /><span>KK</span></div>}
              </div>
              <div className="search-box" style={{ marginTop: '25px', borderTop: '1px solid #eee', paddingTop: '15px' }}>
                <input type="text" placeholder="Cari Nama untuk Edit Data..." value={adminSearch} onChange={e => onAdminSearch(e.target.value)} />
              </div>
              <div className="admin-action-buttons">
                <button className="btn-save" onClick={handleSaveUmat}>SIMPAN / PERBAHARUI DATA ANGGOTA</button>
                {officialAnggota.some(u => u.nama.toLowerCase() === (umatForm.nama || '').toLowerCase()) && (<button className="btn-delete" onClick={() => handleDeleteUmat()}>HAPUS DATA</button>)}
              </div>
            </div>
            <div className="admin-umat-list" style={{ marginTop: '40px' }}>
              <h3>Daftar Seluruh Data Anggota</h3>
              <div className="table-responsive">
                <table className="umat-table admin-table">
                  <thead><tr><th>No</th><th>Nama Anggota</th><th>NIK</th><th>No. HP</th><th>Aksi</th></tr></thead>
                  <tbody>
                    {officialAnggota.length > 0 ? officialAnggota.map((u, idx) => (
                      <tr key={u.id}><td>{idx + 1}</td><td>{u.nama}</td><td>{u.nik || '-'}</td><td>{u.noHp || '-'}</td><td><div className="table-actions"><button className="btn-edit-small" onClick={() => onEditUmat(u)}>Edit</button><button className="btn-delete-small" onClick={() => handleDeleteUmat(u.nama)}>Hapus</button></div></td></tr>
                    )) : <tr><td colSpan={5} style={{ textAlign: 'center' }}>Belum ada data anggota.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="admin-verification-list" style={{ marginTop: '50px', borderTop: '2px solid var(--secondary-color)', paddingTop: '30px' }}>
              <h3>Antrean Revisi / Update Mandiri</h3>
              <div className="table-responsive">
                <table className="umat-table admin-table">
                  <thead><tr><th>No</th><th>Nama Anggota</th><th>Aksi</th></tr></thead>
                  <tbody>
                    {pendingAnggota.length > 0 ? pendingAnggota.map((u, idx) => (
                      <tr key={u.id}><td>{idx + 1}</td><td style={{ fontWeight: '600' }}>{u.nama}</td><td><div className="table-actions"><button className="btn-save" style={{ padding: '6px 15px', fontSize: '0.8rem' }} onClick={() => handleApproveUmat(u)}>Simpan</button><button className="btn-delete" style={{ padding: '6px 15px', fontSize: '0.8rem', marginLeft: '8px' }} onClick={() => handleRejectUmat(u.id)}>Hapus</button></div></td></tr>
                    )) : <tr><td colSpan={3} style={{ textAlign: 'center', padding: '30px', color: '#888' }}>Tidak ada antrean revisi mandiri saat ini.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : (
          <div className="user-data-section">
            <div className="user-search-container" style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
              <input type="text" placeholder="Cari Nama Anggota..." value={userSearch} onChange={e => setUserSearch(e.target.value)} style={{ flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid #ddd' }} />
              <button className="btn-save" onClick={handleUserSearch} style={{ padding: '0 30px' }}>CARI</button>
            </div>
            {hasUserSearched && (
              <div className="search-results-section">
                <div className="table-responsive">
                  <table className="umat-table">
                    <thead><tr><th>No</th><th>NAMA ANGGOTA</th></tr></thead>
                    <tbody>
                      {userSearchResults.length > 0 ? userSearchResults.map((result, idx) => (
                        <tr key={result.id}><td>{idx + 1}</td><td>{result.nama}<div style={{ marginTop: '8px' }}><button className="btn-edit-small" onClick={() => { setUserUmatForm({ ...result }); setShowUserForm(true); setUserSubmitMessage(null); }}>revisi</button></div></td></tr>
                      )) : <tr><td colSpan={2} style={{ textAlign: 'center', padding: '30px', color: '#888' }}>Data Tidak Ditemukan</td></tr>}
                    </tbody>
                  </table>
                </div>
                {userSearchResults.length === 0 && (
                  <div style={{ textAlign: 'center', marginTop: '20px' }}><button className="btn-save" onClick={() => { setUserUmatForm({ nama: '', status: 'Anggota', nik: '', alamat: '', noHp: '', photo: '', kk: '' }); setShowUserForm(true); setUserSubmitMessage(null); }}>Isi secara mandiri</button></div>
                )}
              </div>
            )}
            {showUserForm && (
              <div className="user-input-form" style={{ marginTop: '40px', padding: '25px', background: '#f9f9f9', borderRadius: '12px', border: '1px solid #eee' }}>
                <h3>Lengkapi Data Anggota</h3>
                <div className="form-grid">
                  <div className="form-group"><label>Nama Anggota <span style={{ color: 'red' }}>*</span>:</label><input type="text" value={userUmatForm.nama} onChange={e => setUserUmatForm({ ...userUmatForm, nama: e.target.value })} required /></div>
                  <div className="form-group"><label>NIK:</label><input type="text" value={userUmatForm.nik} onChange={e => setUserUmatForm({ ...userUmatForm, nik: e.target.value })} /></div>
                  <div className="form-group"><label>No. HP:</label><input type="text" value={userUmatForm.noHp} onChange={e => setUserUmatForm({ ...userUmatForm, noHp: e.target.value })} /></div>
                  <div className="form-group full-width"><label>Alamat:</label><textarea value={userUmatForm.alamat} onChange={e => setUserUmatForm({ ...userUmatForm, alamat: e.target.value })} /></div>
                  <div className="form-group"><label>Upload Photo (Maksimal 5 MB):</label><input type="file" accept="image/*" onChange={(e) => { const file = e.target.files?.[0]; if (file) { const reader = new FileReader(); reader.onloadend = async () => { const base64 = reader.result as string; const compressed = await compressImage(base64, 800, 0.6); setUserUmatForm({ ...userUmatForm, photo: compressed }); }; reader.readAsDataURL(file); } }} /></div>
                  <div className="form-group"><label>Upload KK (Kartu Keluarga - Maksimal 5 MB):</label><input type="file" accept="image/*" onChange={(e) => { const file = e.target.files?.[0]; if (file) { const reader = new FileReader(); reader.onloadend = async () => { const base64 = reader.result as string; const compressed = await compressImage(base64, 800, 0.6); setUserUmatForm({ ...userUmatForm, kk: compressed }); }; reader.readAsDataURL(file); } }} /></div>
                </div>
                <div style={{ textAlign: 'center', marginTop: '30px' }}><button className="btn-save" onClick={handleUserFormSubmit} disabled={isSubmittingUserForm}>{isSubmittingUserForm ? 'Mengirim...' : 'KIRIM'}</button></div>
              </div>
            )}
            {userSubmitMessage && <div style={{ marginTop: '25px', padding: '15px', backgroundColor: '#e8f5e9', color: '#2e7d32', borderRadius: '8px', textAlign: 'center', fontWeight: '600', border: '1px solid #c8e6c9' }}>{userSubmitMessage}</div>}
          </div>
        )}
      </div>
    )
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
    if (activeTab === 'Pengurus') return renderPengurus()

    const currentPage = siteContent.pages[activeTab]
    if (!currentPage) return null

    return (
      <div className="page-content">
        {!isLoggedIn ? (
          <div className="page-card">
            <h2>{currentPage.title}</h2>
            <div className="content-body" dangerouslySetInnerHTML={{ __html: (currentPage.content || '').replace(/&nbsp;/g, ' ') }} />
            {activeTab === 'Beranda' && siteContent.settings.berandaPdf && (
              <div className="pdf-viewer-section" style={{ marginTop: '20px', borderTop: '1px solid #eee', paddingTop: '20px' }}>
                {!showPdfReader ? (
                  <button className="btn-save" onClick={() => setShowPdfReader(true)}>Read More (Buka PDF)</button>
                ) : (
                  <div className="pdf-reader-container">
                    <button className="btn-delete" onClick={() => setShowPdfReader(false)} style={{ marginBottom: '10px' }}>Tutup PDF</button>
                    <iframe src={`${siteContent.settings.berandaPdf}#toolbar=0`} width="100%" height="600px" style={{ border: 'none', borderRadius: '8px' }} title="PDF Viewer"></iframe>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <AdminDashboard
            initialTitle={editTitle || ''} initialContent={editContent || ''} initialSiteTitle={editSiteTitle || ''} initialSiteLogo={editLogo || ''} initialBerandaPdf={editBerandaPdf || ''}
            onSave={(data: any) => { setEditTitle(data.title || ''); setEditContent(data.content || ''); setEditSiteTitle(data.siteTitle || ''); setEditLogo(data.siteLogo || ''); setEditBerandaPdf(data.berandaPdf || ''); }}
            onPublish={(data: any) => saveChanges(data)} isSaving={isSaving}
          />
        )}
      </div>
    )
  }

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
    </div>
  )
}

export default App;