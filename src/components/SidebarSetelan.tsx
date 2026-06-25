import React, { useState } from 'react';
import { compressImage } from '../utils/imageUtils';

interface SidebarSetelanProps {
  label: string;
  setLabel: (val: string) => void;
  jadwal: string;
  setJadwal: (val: string) => void;
  tautan: string;
  setTautan: (val: string) => void;
  komentar: boolean;
  setKomentar: (val: boolean) => void;
  siteTitle: string;
  setSiteTitle: (val: string) => void;
  siteLogo: string;
  setSiteLogo: (val: string) => void;
}

const SidebarSetelan: React.FC<SidebarSetelanProps> = ({
  label, setLabel, jadwal, setJadwal, tautan, setTautan, komentar, setKomentar,
  siteTitle, setSiteTitle, siteLogo, setSiteLogo,
}) => {
  const [activeSection, setActiveSection] = useState<string | null>('label');

  const toggleSection = (section: string) => {
    setActiveSection(activeSection === section ? null : section);
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        alert('File terlalu besar! Maksimal ukuran logo adalah 2 MB.');
        e.target.value = '';
        return;
      }
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result as string;
        const compressed = await compressImage(base64, 400, 0.7);
        setSiteLogo(compressed);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="sidebar-setelan">
      <div className="sidebar-section">
        <div className="sidebar-header" onClick={() => toggleSection('site')}>
          <span>Setelan Situs</span>
          <span className="arrow">{activeSection === 'site' ? '▾' : '▸'}</span>
        </div>
        {activeSection === 'site' && (
          <div className="sidebar-content">
            <div className="sidebar-field">
              <label>Judul Situs</label>
              <input
                type="text"
                value={siteTitle}
                onChange={(e) => setSiteTitle(e.target.value)}
                className="sidebar-input"
              />
            </div>
            <div className="sidebar-field" style={{ marginTop: '10px' }}>
              <label>Logo Situs (Maksimal 2 MB)</label>
              {siteLogo && (
                <div style={{ marginBottom: '5px' }}>
                  <img src={siteLogo} alt="Logo" style={{ maxHeight: '40px', borderRadius: '4px' }} />
                </div>
              )}
              <input
                type="file"
                accept="image/*"
                onChange={handleLogoUpload}
                className="sidebar-input"
              />
            </div>
          </div>
        )}
      </div>

      <div className="sidebar-section">
        <div className="sidebar-header" onClick={() => toggleSection('label')}>
          <span>Label</span>
          <span className="arrow">{activeSection === 'label' ? '▾' : '▸'}</span>
        </div>
        {activeSection === 'label' && (
          <div className="sidebar-content">
            <input
              type="text"
              placeholder="Pisahkan dengan koma"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="sidebar-input"
            />
          </div>
        )}
      </div>

      <div className="sidebar-section">
        <div className="sidebar-header" onClick={() => toggleSection('jadwal')}>
          <span>Jadwal</span>
          <span className="arrow">{activeSection === 'jadwal' ? '▾' : '▸'}</span>
        </div>
        {activeSection === 'jadwal' && (
          <div className="sidebar-content">
            <input
              type="datetime-local"
              value={jadwal}
              onChange={(e) => setJadwal(e.target.value)}
              className="sidebar-input"
            />
          </div>
        )}
      </div>

      <div className="sidebar-section">
        <div className="sidebar-header" onClick={() => toggleSection('tautan')}>
          <span>Tautan</span>
          <span className="arrow">{activeSection === 'tautan' ? '▾' : '▸'}</span>
        </div>
        {activeSection === 'tautan' && (
          <div className="sidebar-content">
            <input
              type="text"
              placeholder="Permalink khusus"
              value={tautan}
              onChange={(e) => setTautan(e.target.value)}
              className="sidebar-input"
            />
          </div>
        )}
      </div>

      <div className="sidebar-section">
        <div className="sidebar-header" onClick={() => toggleSection('opsi')}>
          <span>Opsi Komentar</span>
          <span className="arrow">{activeSection === 'opsi' ? '▾' : '▸'}</span>
        </div>
        {activeSection === 'opsi' && (
          <div className="sidebar-content">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={komentar}
                onChange={(e) => setKomentar(e.target.checked)}
              />
              Izinkan komentar
            </label>
          </div>
        )}
      </div>
    </div>
  );
};

export default SidebarSetelan;
