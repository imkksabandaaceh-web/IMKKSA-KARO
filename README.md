# Karo — Panduan Penerapan File Bersih (Tanpa PDF)

## File yang diperbarui

| File | Lokasi di project | Perubahan |
|------|-------------------|-----------|
| `App.tsx` | `src/App.tsx` | Hapus PDF reader, download PDF, lacak PDF, DownloadProposal, PdfLoadingSpinner, proposal handlers, `berandaPdf` state |
| `package.json` | `package.json` (root) | Hapus `pdf-lib`, `@pdf-lib/fontkit`, `pdfjs-dist` |
| `vite.config.ts` | `vite.config.ts` (root) | Hapus chunk `vendor-pdf`, hapus exclude `pdfjs-dist` dari optimizeDeps |
| `deploy.sh` | `deploy.sh` (root) | Script otomatis untuk localhost & GitHub |

---

## Cara Menggunakan

### 1. Copy file ke project Anda

```bash
# Dari folder hasil download ini, copy ke project karo/:
cp App.tsx       /path/to/karo/src/App.tsx
cp package.json  /path/to/karo/package.json
cp vite.config.ts /path/to/karo/vite.config.ts
cp deploy.sh     /path/to/karo/deploy.sh
```

### 2. Beri izin eksekusi pada deploy.sh

```bash
cd /path/to/karo
chmod +x deploy.sh
```

### 3. Jalankan script deploy

```bash
./deploy.sh
```

Script akan menanyakan pilihan:
- **[1]** → Jalankan di localhost (`http://localhost:5173`)
- **[2]** → Build + `git push origin master`
- **[3]** → Localhost dulu, lalu push ke GitHub

---

## Cara Manual (tanpa script)

### Jalankan di localhost

```bash
cd /path/to/karo
npm install          # install ulang (hapus node_modules PDF lama)
npm run dev          # buka http://localhost:5173
```

### Push ke GitHub

```bash
cd /path/to/karo
npm run build        # pastikan build berhasil dulu
git add .
git commit -m "hapus fitur PDF - bersihkan dependensi"
git push origin master
```

---

## Yang Dihapus

- `DownloadProposal` component (lazy load)
- `PdfLoadingSpinner` component
- `handleAddProposal`, `handleEditProposal`, `handleDeleteProposal`
- State `editBerandaPdf` dan `berandaPdf` di `SiteSettings`
- `proposals` dari `FullContent` dan `DEFAULT_CONTENT`
- Import `Suspense`, `lazy` dari React
- Semua referensi PDF di tab Beranda dan Jadwal Keluarga
- Dependensi: `pdf-lib`, `@pdf-lib/fontkit`, `pdfjs-dist`
- Chunk `vendor-pdf` di vite.config.ts

## Estimasi Penghematan Bundle

| Sebelum | Sesudah |
|---------|---------|
| ~3.8 MB+ (dengan PDF libs) | ~600 KB (tanpa PDF) |
