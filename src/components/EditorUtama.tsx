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
  scriptUrl: string;
}

const EditorUtama: React.FC<EditorUtamaProps> = ({ title, setTitle, content, setContent, scriptUrl }) => {
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
          const compressed = await compressImage(base64, 800, 0.7);

          const quill = quillRef.current?.getEditor();
          if (quill) {
            const range = quill.getSelection();
            if (range) {
              // Menampilkan placeholder loading sementara proses upload ke Google Drive
              const placeholderIndex = range.index;
              quill.insertText(placeholderIndex, '[Mengunggah gambar...]');
              
              try {
                const response = await fetch(scriptUrl, {
                  method: 'POST',
                  mode: 'cors',
                  headers: { 'Content-Type': 'text/plain' },
                  body: JSON.stringify({
                    action: 'uploadImage',
                    data: { base64: compressed }
                  })
                });
                const result = await response.json();
                
                // Hapus tulisan loading
                quill.deleteText(placeholderIndex, '[Mengunggah gambar...]'.length);
                
                if (result.success && result.url) {
                  quill.insertEmbed(placeholderIndex, 'image', result.url);
                } else {
                  console.error("Gagal unggah gambar:", result.error);
                  alert("Gagal mengunggah gambar ke Google Drive: " + (result.error || "Error tidak diketahui"));
                }
              } catch (err) {
                // Hapus tulisan loading
                quill.deleteText(placeholderIndex, '[Mengunggah gambar...]'.length);
                console.error("Error upload gambar ke Google Drive:", err);
                alert("Terjadi kesalahan saat mengunggah gambar: " + (err instanceof Error ? err.message : String(err)));
              }
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
    </div>
  );
};

export default EditorUtama;
