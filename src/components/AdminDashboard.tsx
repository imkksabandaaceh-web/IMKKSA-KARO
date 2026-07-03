import React, { useState, useEffect } from 'react';
import HeaderAksi from './HeaderAksi';
import EditorUtama from './EditorUtama';
import SidebarSetelan from './SidebarSetelan';

interface AdminDashboardProps {
  initialTitle: string;
  initialContent: string;
  initialSiteTitle: string;
  initialSiteLogo: string;
  onSave: (data: any) => void;
  onPublish: (data: any) => void;
  isSaving: boolean;
  scriptUrl: string;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({
  initialTitle, initialContent,
  initialSiteTitle, initialSiteLogo,
  onSave, onPublish, isSaving, scriptUrl
}) => {
  const [title, setTitle] = useState(initialTitle);
  const [content, setContent] = useState(initialContent);
  const [siteTitle, setSiteTitle] = useState(initialSiteTitle);
  const [siteLogo, setSiteLogo] = useState(initialSiteLogo);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Sidebar states
  const [label, setLabel] = useState('');

  useEffect(() => {
    setTitle(initialTitle);
    setContent(initialContent);
    setSiteTitle(initialSiteTitle);
    setSiteLogo(initialSiteLogo);
  }, [initialTitle, initialContent, initialSiteTitle, initialSiteLogo]);

  const handlePublish = () => {
    onPublish({ title, content, label, siteTitle, siteLogo });
  };

  const handlePreview = () => {
    onSave({ title, content, label, siteTitle, siteLogo });
  };

  return (
    <div className={`admin-dashboard ${isSidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
      <div className="dashboard-layout">
        <div className="editor-container">
          <EditorUtama
            title={title}
            setTitle={setTitle}
            content={content}
            setContent={setContent}
            scriptUrl={scriptUrl}
          />
        </div>

        <div className="sidebar-container">
          <div className="sidebar-toggle-btn" onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
            {isSidebarOpen ? '▶' : '◀'} Setelan
          </div>
          <div className={`sidebar-wrapper ${isSidebarOpen ? 'open' : 'closed'}`}>
            <SidebarSetelan
              label={label} setLabel={setLabel}
              siteTitle={siteTitle} setSiteTitle={setSiteTitle}
              siteLogo={siteLogo} setSiteLogo={setSiteLogo}
            />
          </div>
        </div>
      </div>

      <HeaderAksi
        onPublish={handlePublish}
        onPreview={handlePreview}
        isSaving={isSaving}
      />
    </div>
  );
};

export default AdminDashboard;
