import React, { useRef, useMemo } from 'react';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import EditorToolbar, { modules, formats } from './EditorToolbar';
import { compressImage } from '../utils/imageUtils';

/**
 * Retry wrapper untuk fetch upload gambar ke Google Apps Script.
 * Google Apps Script free tier memiliki "cold start" — request pertama
 * setelah idle ~5 menit sering timeout atau gagal CORS. Dengan retry
 * otomatis, request kedua/ketiga biasanya berhasil karena server sudah
 * "hangat" (warm).
 */
const uploadWithRetry = async (
  scriptUrl: string,
  body: string,
  maxRetries = 2,
  delayMs = 2000
): Promise<any> => {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(scriptUrl, {
        method: 'POST',
        mode: 'cors',
        headers: { 'Content-Type': 'text/plain' },
        body,
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return await response.json();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.warn(
        `[Upload Retry] Percobaan ${attempt + 1}/${maxRetries + 1} gagal:`,
        lastError.message
      );
      // Tunggu sebelum retry (hanya jika masih ada sisa percobaan)
      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, delayMs * (attempt + 1)));
      }
    }
  }
  throw lastError!;
};

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
                // Gunakan uploadWithRetry untuk mengatasi Google Apps Script
                // "cold start" (server tidur ~5 menit → request pertama sering timeout)
                const result = await uploadWithRetry(
                  scriptUrl,
                  JSON.stringify({
                    action: 'uploadImage',
                    data: { base64: compressed }
                  })
                );
                
                // Hapus tulisan loading
                quill.deleteText(placeholderIndex, '[Mengunggah gambar...]'.length);
                
                if (result.success && result.url) {
                  quill.insertEmbed(placeholderIndex, 'image', result.url);
                } else {
                  console.error("Gagal unggah gambar:", result.error);
                  alert("Gagal mengunggah gambar ke Google Drive: " + (result.error || "Error tidak diketahui. Coba lagi dalam beberapa detik."));
                }
              } catch (err) {
                // Hapus tulisan loading
                quill.deleteText(placeholderIndex, '[Mengunggah gambar...]'.length);
                console.error("Error upload gambar ke Google Drive:", err);
                const errMsg = err instanceof Error ? err.message : String(err);
                // Pesan yang lebih informatif untuk masalah cold start
                if (errMsg.includes('Failed to fetch') || errMsg.includes('NetworkError')) {
                  alert(`Gagal terhubung ke server Google Drive.\n\nKemungkinan server sedang "memuai" (cold start). Silakan tunggu 5 detik lalu coba lagi.`);
                } else {
                  alert("Terjadi kesalahan saat mengunggah gambar: " + errMsg + "\n\nSilakan coba lagi dalam beberapa detik.");
                }
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
