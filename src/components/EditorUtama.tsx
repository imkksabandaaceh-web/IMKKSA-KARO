import React, { useRef, useMemo } from 'react';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import EditorToolbar, { modules, formats } from './EditorToolbar';
import { compressImage } from '../utils/imageUtils';

interface EditorUtamaProps {
  title: string;
  setTitle: (title: string) => void;
  content: string;
  setContent: (content: string) => void;
  berandaPdf?: string;
}

const EditorUtama: React.FC<EditorUtamaProps> = ({ title, setTitle, content, setContent, berandaPdf }) => {
  const quillRef = useRef<ReactQuill>(null);

  const imageHandler = () => {
    const input = document.createElement('input');
    input.setAttribute('type', 'file');
    input.setAttribute('accept', 'image/*');
    input.click();

    input.onchange = async () => {
      const file = input.files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = async () => {
          const base64 = reader.result as string;
          // Kompres gambar sebelum dimasukkan ke editor
          const compressed = await compressImage(base64, 800, 0.7);

          const quill = quillRef.current?.getEditor();
          if (quill) {
            const range = quill.getSelection();
            if (range) {
              quill.insertEmbed(range.index, 'image', compressed);
            }
          }
        };
        reader.readAsDataURL(file);
      }
    };
  };

  const customModules = useMemo(() => ({
    ...modules,
    toolbar: {
      container: "#toolbar",
      handlers: {
        image: imageHandler
      }
    }
  }), []);

  return (
    <div className="editor-utama">
      <div className="editor-title-container">
        <input 
          type="text" 
          className="editor-title-input" 
          placeholder="Judul Materi" 
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>
      <EditorToolbar />
      <div className="quill-wrapper">
        <ReactQuill 
          ref={quillRef}
          theme="snow"
          value={content}
          onChange={setContent}
          modules={customModules}
          formats={formats}
          placeholder="Tulis materi di sini..."
        />
      </div>

      {berandaPdf && (
        <div className="admin-pdf-preview" style={{ marginTop: '30px', padding: '20px', background: '#f8f9fa', borderRadius: '8px', border: '1px solid #dee2e6' }}>
          <h4>Preview PDF (Warta Jemaat):</h4>
          <iframe 
            src={berandaPdf} 
            width="100%" 
            height="400px" 
            style={{ border: '1px solid #ccc', borderRadius: '4px' }}
            title="Admin PDF Preview"
          ></iframe>
          <div style={{ marginTop: '15px' }}>
            <a 
              href={berandaPdf} 
              download="Informasi_Anggota_IMKKSA.pdf" 
              target="_blank" 
              rel="noopener noreferrer"
              className="btn-save"
              style={{ textDecoration: 'none', display: 'inline-block' }}
            >
              Download PDF (Admin)
            </a>
          </div>
        </div>
      )}
    </div>
  );
};

export default EditorUtama;
