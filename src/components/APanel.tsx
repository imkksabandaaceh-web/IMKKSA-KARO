import React, { useState } from 'react';
import { compressImage } from '../utils/imageUtils';

// --- Tipe ini harus selalu sama persis dengan interface SiteSettings di App.tsx ---
interface SiteSettings {
  logo: string;
  title: string;
  pengurusRaw?: string;
  primaryColor?: string;
  secondaryColor?: string;
  navBgColor?: string;
  navTextColor?: string;
  siteBgColor?: string;
  headerFontFamily?: string;
  headerFontSize?: string;
  headerBgImage?: string;
  headerBgOverlay?: string;
  navFontFamily?: string;
  navFontSize?: string;
  navFontWeight?: string;
}

interface APanelProps {
  settings: SiteSettings;
  onSaveSettings: (newSettings: SiteSettings) => Promise<void> | void;
  onLogout: () => void;
  scriptUrl: string;
}

const FONT_FAMILIES_HEADER = [
  { label: 'Playfair Display (Klasik & Elegan)', value: "'Playfair Display', serif" },
  { label: 'Outfit (Modern Bersih)', value: "'Outfit', sans-serif" },
  { label: 'Poppins (Bulat & Modern)', value: "'Poppins', sans-serif" },
  { label: 'Montserrat (Tegas & Bersih)', value: "'Montserrat', sans-serif" },
  { label: 'Inter (Minimalis Standar)', value: "'Inter', sans-serif" },
  { label: 'Georgia (Serif Formal)', value: 'Georgia, serif' },
];

const FONT_FAMILIES_NAV = [
  { label: 'Inter (Rapi & Minimalis)', value: "'Inter', sans-serif" },
  { label: 'Poppins (Ramah & Bulat)', value: "'Poppins', sans-serif" },
  { label: 'Montserrat (Serbaguna)', value: "'Montserrat', sans-serif" },
  { label: 'Outfit (Modern)', value: "'Outfit', sans-serif" },
];

const FONT_WEIGHTS = [
  { label: 'Normal', value: '400' },
  { label: 'Sedang', value: '500' },
  { label: 'Tebal', value: '600' },
  { label: 'Ekstra Tebal', value: '700' },
];

const COLOR_PRESETS_PRIMARY = [
  { name: 'Hijau IMKKSA (Default)', hex: '#2e7d32' },
  { name: 'Navy Biru', hex: '#1a365d' },
  { name: 'Merah Marun', hex: '#8b0000' },
  { name: 'Emas Hangat', hex: '#b45309' },
  { name: 'Ungu Tua', hex: '#7c3aed' },
  { name: 'Abu Gelap', hex: '#0f172a' },
];

const COLOR_PRESETS_NAV_BG = [
  { name: 'Hijau Tua (Default)', hex: '#2f5d50' },
  { name: 'Navy Biru', hex: '#1a365d' },
  { name: 'Merah Marun', hex: '#8b0000' },
  { name: 'Abu Slate', hex: '#334155' },
  { name: 'Hitam Pekat', hex: '#0f172a' },
];

const COLOR_PRESETS_SITE_BG = [
  { name: 'Hijau Muda (Default)', hex: '#f4f8f4' },
  { name: 'Putih Bersih', hex: '#ffffff' },
  { name: 'Krem Lembut', hex: '#fdfaf5' },
  { name: 'Abu Terang', hex: '#f8fafc' },
];

// Helper: ambil nilai alpha (0-1) dari string 'rgba(0, 0, 0, 0.25)'
const getOverlayAlpha = (rgba: string): number => {
  const match = rgba.match(/rgba?\([^)]*,\s*([\d.]+)\s*\)/);
  return match ? parseFloat(match[1]) : 0.25;
};

// Helper: baca file gambar dari input menjadi base64
const readFileAsBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

export const APanel: React.FC<APanelProps> = ({ settings, onSaveSettings, onLogout, scriptUrl }) => {
  const [activeTab, setActiveTab] = useState<'header' | 'navigasi'>('header');

  // --- State pengaturan (diisi dari settings yang sedang aktif) ---
  const [siteTitle, setSiteTitle] = useState(settings.title || 'IMKKSA Banda Aceh Sekitar');
  const [logoUrl, setLogoUrl] = useState(settings.logo || '/LOGO_KARO.jpg');
  const [headerFontFamily, setHeaderFontFamily] = useState(settings.headerFontFamily || "'Playfair Display', serif");
  const [headerFontSize, setHeaderFontSize] = useState(settings.headerFontSize || 'clamp(1.8rem, 6vw, 3.2rem)');
  const [primaryColor, setPrimaryColor] = useState(settings.primaryColor || '#2e7d32');
  const [headerBgImage, setHeaderBgImage] = useState(settings.headerBgImage || '');
  const [headerBgOverlay, setHeaderBgOverlay] = useState(settings.headerBgOverlay || 'rgba(0, 0, 0, 0.25)');

  const [navBgColor, setNavBgColor] = useState(settings.navBgColor || '#2f5d50');
  const [navTextColor, setNavTextColor] = useState(settings.navTextColor || '#ffffff');
  const [navFontFamily, setNavFontFamily] = useState(settings.navFontFamily || "'Inter', sans-serif");
  const [navFontSize, setNavFontSize] = useState(settings.navFontSize || '1rem');
  const [navFontWeight, setNavFontWeight] = useState(settings.navFontWeight || '500');
  const [secondaryColor, setSecondaryColor] = useState(settings.secondaryColor || '#8bc34a');
  const [siteBgColor, setSiteBgColor] = useState(settings.siteBgColor || '#f4f8f4');

  // --- Status upload & simpan ---
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isUploadingHeaderBg, setIsUploadingHeaderBg] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Upload gambar ke Google Drive lewat Apps Script (pola yang sama dengan upload logo di AdminDashboard)
  const uploadImage = async (file: File): Promise<string> => {
    const rawBase64 = await readFileAsBase64(file);
    const compressed = await compressImage(rawBase64, 1200, 0.8);

    const res = await fetch(scriptUrl, {
      method: 'POST',
      mode: 'cors',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ action: 'uploadImage', data: { base64: compressed } }),
    });
    const result = await res.json();
    if (result.success && result.url) {
      return result.url;
    }
    throw new Error(result.error || 'Upload gagal, tidak ada URL yang dikembalikan.');
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingLogo(true);
    setMessage(null);
    try {
      const url = await uploadImage(file);
      setLogoUrl(url);
      setMessage({ type: 'success', text: 'Logo berhasil diunggah ke Google Drive!' });
    } catch (err: any) {
      setMessage({ type: 'error', text: 'Gagal mengunggah logo: ' + (err?.message || 'Error tidak diketahui') });
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const handleHeaderBgUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingHeaderBg(true);
    setMessage(null);
    try {
      const url = await uploadImage(file);
      setHeaderBgImage(url);
      setMessage({ type: 'success', text: 'Gambar latar header berhasil diunggah!' });
    } catch (err: any) {
      setMessage({ type: 'error', text: 'Gagal mengunggah gambar header: ' + (err?.message || 'Error tidak diketahui') });
    } finally {
      setIsUploadingHeaderBg(false);
    }
  };

  const handleRemoveHeaderBg = () => {
    setHeaderBgImage('');
    setMessage({ type: 'success', text: 'Gambar latar header dihapus. Header kembali polos.' });
  };

  const handleSaveAll = async () => {
    setIsSaving(true);
    setMessage(null);

    const updatedSettings: SiteSettings = {
      ...settings,
      title: siteTitle,
      logo: logoUrl,
      headerFontFamily,
      headerFontSize,
      primaryColor,
      headerBgImage,
      headerBgOverlay,
      navBgColor,
      navTextColor,
      navFontFamily,
      navFontSize,
      navFontWeight,
      secondaryColor,
      siteBgColor,
    };

    try {
      await onSaveSettings(updatedSettings);
      setMessage({ type: 'success', text: '✅ Semua perubahan berhasil disimpan! Tunggu beberapa detik sebelum refresh halaman.' });
    } catch (err: any) {
      setMessage({ type: 'error', text: 'Gagal menyimpan ke server: ' + (err?.message || 'Periksa koneksi internet.') });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
        <h2 style={{ margin: 0, color: '#1e293b' }}>⚙️ A.Panel — Pengaturan Tampilan Situs</h2>
        <button
          type="button"
          onClick={onLogout}
          style={{ padding: '8px 16px', backgroundColor: '#ef4444', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
        >
          🚪 Logout
        </button>
      </div>

      {message && (
        <div
          style={{
            padding: '12px 16px',
            borderRadius: '8px',
            marginBottom: '20px',
            backgroundColor: message.type === 'success' ? '#e8f5e9' : '#ffebee',
            color: message.type === 'success' ? '#1b5e20' : '#c62828',
            border: `1px solid ${message.type === 'success' ? '#a5d6a7' : '#ef9a9a'}`,
          }}
        >
          {message.text}
        </div>
      )}

      {/* TABS */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', borderBottom: '2px solid #e2e8f0' }}>
        {[
          { key: 'header', label: '🖼️ Header & Logo' },
          { key: 'navigasi', label: '🧭 Navigasi & Warna' },
        ].map(tab => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key as 'header' | 'navigasi')}
            style={{
              padding: '10px 20px',
              border: 'none',
              borderBottom: activeTab === tab.key ? '3px solid #2e7d32' : '3px solid transparent',
              backgroundColor: 'transparent',
              fontWeight: activeTab === tab.key ? 700 : 500,
              color: activeTab === tab.key ? '#2e7d32' : '#64748b',
              cursor: 'pointer',
              fontSize: '0.95rem',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB 1: HEADER */}
      {activeTab === 'header' && (
        <div style={{ backgroundColor: '#f8fafc', padding: '24px', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '24px' }}>
          <div style={{ marginBottom: '24px' }}>
            <label style={{ fontWeight: 600, display: 'block', marginBottom: '8px' }}>📝 Judul Situs (ditampilkan di Header)</label>
            <input
              type="text"
              value={siteTitle}
              onChange={e => setSiteTitle(e.target.value)}
              style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '1rem' }}
            />
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label style={{ fontWeight: 600, display: 'block', marginBottom: '8px' }}>🖼️ Logo Situs</label>
            <div style={{ display: 'flex', gap: '15px', alignItems: 'center', flexWrap: 'wrap' }}>
              {logoUrl && <img src={logoUrl} alt="Preview logo" style={{ width: '60px', height: '60px', objectFit: 'cover', borderRadius: '50%', border: '2px solid #cbd5e1' }} />}
              <input type="file" accept="image/*" onChange={handleLogoUpload} disabled={isUploadingLogo} />
              {isUploadingLogo && <span style={{ color: '#64748b' }}>⏳ Mengunggah...</span>}
            </div>
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label style={{ fontWeight: 600, display: 'block', marginBottom: '8px' }}>🔤 Font Judul Header</label>
            <select
              value={headerFontFamily}
              onChange={e => setHeaderFontFamily(e.target.value)}
              style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '1rem' }}
            >
              {FONT_FAMILIES_HEADER.map(f => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label style={{ fontWeight: 600, display: 'block', marginBottom: '8px' }}>
              📏 Ukuran Font Judul Header: <span style={{ color: '#2e7d32' }}>{headerFontSize}</span>
            </label>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              {['clamp(1.4rem, 5vw, 2.4rem)', 'clamp(1.8rem, 6vw, 3.2rem)', 'clamp(2.2rem, 7vw, 4rem)'].map((size, i) => (
                <button
                  key={size}
                  type="button"
                  onClick={() => setHeaderFontSize(size)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '20px',
                    border: headerFontSize === size ? '2px solid #2e7d32' : '1px solid #cbd5e1',
                    backgroundColor: headerFontSize === size ? '#e8f5e9' : '#fff',
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                  }}
                >
                  {['Kecil', 'Sedang (Default)', 'Besar'][i]}
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label style={{ fontWeight: 600, display: 'block', marginBottom: '8px' }}>✨ Warna Aksen Utama (judul, border, tombol)</label>
            <div style={{ display: 'flex', gap: '15px', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap' }}>
              <input type="color" value={primaryColor} onChange={e => setPrimaryColor(e.target.value)} style={{ width: '50px', height: '42px', border: 'none', cursor: 'pointer', borderRadius: '6px' }} />
              <input type="text" value={primaryColor} onChange={e => setPrimaryColor(e.target.value)} style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', width: '140px', fontFamily: 'monospace' }} />
            </div>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              {COLOR_PRESETS_PRIMARY.map(p => (
                <button
                  key={p.hex}
                  type="button"
                  onClick={() => setPrimaryColor(p.hex)}
                  style={{ backgroundColor: p.hex, color: '#fff', border: primaryColor === p.hex ? '3px solid #000' : 'none', padding: '8px 14px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}
                >
                  {p.name}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label style={{ fontWeight: 600, display: 'block', marginBottom: '8px' }}>🌄 Gambar Latar Header (opsional)</label>
            <div style={{ display: 'flex', gap: '15px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '10px' }}>
              <input type="file" accept="image/*" onChange={handleHeaderBgUpload} disabled={isUploadingHeaderBg} />
              {isUploadingHeaderBg && <span style={{ color: '#64748b' }}>⏳ Mengunggah...</span>}
              {headerBgImage && (
                <button type="button" onClick={handleRemoveHeaderBg} style={{ padding: '6px 14px', backgroundColor: '#ef4444', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem' }}>
                  ✕ Hapus Gambar
                </button>
              )}
            </div>
            {headerBgImage && (
              <div style={{ marginTop: '10px' }}>
                <label style={{ fontSize: '0.85rem', color: '#64748b', display: 'block', marginBottom: '6px' }}>Kegelapan overlay (agar judul tetap terbaca di atas gambar):</label>
                <input
                  type="range"
                  min={0}
                  max={80}
                  step={5}
                  value={Math.round(getOverlayAlpha(headerBgOverlay) * 100)}
                  onChange={e => setHeaderBgOverlay(`rgba(0, 0, 0, ${Number(e.target.value) / 100})`)}
                  style={{ width: '100%' }}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: NAVIGASI & WARNA */}
      {activeTab === 'navigasi' && (
        <div style={{ backgroundColor: '#f8fafc', padding: '24px', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '24px' }}>
          <div style={{ marginBottom: '24px' }}>
            <label style={{ fontWeight: 600, display: 'block', marginBottom: '8px' }}>🎨 Warna Latar Belakang Navbar (menu)</label>
            <div style={{ display: 'flex', gap: '15px', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap' }}>
              <input type="color" value={navBgColor} onChange={e => setNavBgColor(e.target.value)} style={{ width: '50px', height: '42px', border: 'none', cursor: 'pointer', borderRadius: '6px' }} />
              <input type="text" value={navBgColor} onChange={e => setNavBgColor(e.target.value)} style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', width: '140px', fontFamily: 'monospace' }} />
            </div>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              {COLOR_PRESETS_NAV_BG.map(p => (
                <button key={p.hex} type="button" onClick={() => setNavBgColor(p.hex)} style={{ backgroundColor: p.hex, color: '#fff', border: navBgColor === p.hex ? '3px solid #000' : 'none', padding: '8px 14px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}>
                  {p.name}
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label style={{ fontWeight: 600, display: 'block', marginBottom: '8px' }}>🔤 Warna Teks / List Menu</label>
            <div style={{ display: 'flex', gap: '15px', alignItems: 'center', flexWrap: 'wrap' }}>
              <input type="color" value={navTextColor} onChange={e => setNavTextColor(e.target.value)} style={{ width: '50px', height: '42px', border: 'none', cursor: 'pointer', borderRadius: '6px' }} />
              <input type="text" value={navTextColor} onChange={e => setNavTextColor(e.target.value)} style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', width: '140px', fontFamily: 'monospace' }} />
            </div>
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label style={{ fontWeight: 600, display: 'block', marginBottom: '8px' }}>✨ Warna Aksen Hover / Menu Aktif</label>
            <div style={{ display: 'flex', gap: '15px', alignItems: 'center', flexWrap: 'wrap' }}>
              <input type="color" value={secondaryColor} onChange={e => setSecondaryColor(e.target.value)} style={{ width: '50px', height: '42px', border: 'none', cursor: 'pointer', borderRadius: '6px' }} />
              <input type="text" value={secondaryColor} onChange={e => setSecondaryColor(e.target.value)} style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', width: '140px', fontFamily: 'monospace' }} />
            </div>
          </div>

          <div style={{ marginBottom: '24px', display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 200px' }}>
              <label style={{ fontWeight: 600, display: 'block', marginBottom: '8px' }}>Font Menu Navbar</label>
              <select value={navFontFamily} onChange={e => setNavFontFamily(e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
                {FONT_FAMILIES_NAV.map(f => (
                  <option key={f.value} value={f.value}>{f.label}</option>
                ))}
              </select>
            </div>
            <div style={{ flex: '1 1 150px' }}>
              <label style={{ fontWeight: 600, display: 'block', marginBottom: '8px' }}>Ketebalan Font</label>
              <select value={navFontWeight} onChange={e => setNavFontWeight(e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
                {FONT_WEIGHTS.map(f => (
                  <option key={f.value} value={f.value}>{f.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ marginBottom: '10px' }}>
            <label style={{ fontWeight: 600, display: 'block', marginBottom: '8px' }}>
              📏 Ukuran Font Menu: <span style={{ color: '#2e7d32' }}>{navFontSize}</span>
            </label>
            <input
              type="range"
              min={0.8}
              max={1.3}
              step={0.05}
              value={parseFloat(navFontSize)}
              onChange={e => setNavFontSize(`${e.target.value}rem`)}
              style={{ width: '100%' }}
            />
          </div>

          <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid #cbd5e1' }}>
            <label style={{ fontWeight: 600, display: 'block', marginBottom: '8px' }}>🖼️ Warna Latar Belakang Seluruh Halaman</label>
            <div style={{ display: 'flex', gap: '15px', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap' }}>
              <input type="color" value={siteBgColor} onChange={e => setSiteBgColor(e.target.value)} style={{ width: '50px', height: '42px', border: 'none', cursor: 'pointer', borderRadius: '6px' }} />
              <input type="text" value={siteBgColor} onChange={e => setSiteBgColor(e.target.value)} style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', width: '140px', fontFamily: 'monospace' }} />
            </div>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              {COLOR_PRESETS_SITE_BG.map(p => (
                <button key={p.hex} type="button" onClick={() => setSiteBgColor(p.hex)} style={{ backgroundColor: p.hex, color: '#0f172a', border: siteBgColor === p.hex ? '3px solid #000' : '1px solid #cbd5e1', padding: '8px 14px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}>
                  {p.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* LIVE PREVIEW */}
      <div style={{ backgroundColor: siteBgColor, padding: '16px', borderRadius: '12px', border: '2px dashed #cbd5e1', marginBottom: '24px', transition: 'background-color 0.3s ease' }}>
        <h4 style={{ marginTop: 0, color: '#475569', fontSize: '0.9rem' }}>👁️ Pratinjau Langsung</h4>

        <div
          style={{
            textAlign: 'center',
            padding: '30px 15px',
            backgroundColor: '#ffffff',
            backgroundImage: headerBgImage ? `linear-gradient(${headerBgOverlay}, ${headerBgOverlay}), url(${headerBgImage})` : undefined,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            borderBottom: `4px solid ${secondaryColor}`,
            borderRadius: '8px 8px 0 0',
          }}
        >
          {logoUrl && <img src={logoUrl} alt="Preview logo" style={{ height: '60px', marginBottom: '10px', borderRadius: '50%', objectFit: 'cover' }} />}
          <h1
            style={{
              margin: 0,
              fontFamily: headerFontFamily,
              fontSize: headerFontSize,
              color: headerBgImage ? '#ffffff' : primaryColor,
              textTransform: 'uppercase',
              textShadow: headerBgImage ? '0 2px 8px rgba(0,0,0,0.7)' : undefined,
            }}
          >
            {siteTitle}
          </h1>
        </div>

        <div style={{ backgroundColor: navBgColor, padding: '12px 16px', textAlign: 'center', borderRadius: '0 0 8px 8px' }}>
          <ul
            style={{
              listStyle: 'none', margin: 0, padding: 0, display: 'flex', justifyContent: 'center', gap: '18px', flexWrap: 'wrap',
              fontFamily: navFontFamily, fontSize: navFontSize, fontWeight: navFontWeight, color: navTextColor, textTransform: 'uppercase',
            }}
          >
            <li style={{ cursor: 'pointer', color: secondaryColor, fontWeight: 700 }}>Beranda</li>
            <li style={{ cursor: 'pointer' }}>Jadwal Keluarga</li>
            <li style={{ cursor: 'pointer' }}>Galeri</li>
            <li style={{ cursor: 'pointer' }}>Data Anggota</li>
            <li style={{ cursor: 'pointer' }}>Pengurus</li>
          </ul>
        </div>
      </div>

      {/* SAVE BAR */}
      <div style={{ borderTop: '2px solid #f1f5f9', paddingTop: '16px', display: 'flex', justifyContent: 'flex-end' }}>
        <button
          type="button"
          onClick={handleSaveAll}
          disabled={isSaving}
          style={{ padding: '12px 30px', fontSize: '1rem', fontWeight: 700, backgroundColor: '#16a34a', color: '#fff', border: 'none', borderRadius: '8px', cursor: isSaving ? 'not-allowed' : 'pointer', opacity: isSaving ? 0.7 : 1 }}
        >
          {isSaving ? '⏳ MENYIMPAN...' : '💾 SIMPAN SEMUA PERUBAHAN'}
        </button>
      </div>
    </div>
  );
};

export default APanel;
