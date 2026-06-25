#!/usr/bin/env bash
# =============================================================
# deploy.sh — Jalankan di root folder project (karo/)
# Fungsi: install ulang, jalankan di localhost, dan push ke GitHub
# =============================================================

set -e  # Hentikan jika ada error

# ── Warna untuk output ──
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN}  KARO — Deploy Script${NC}"
echo -e "${CYAN}========================================${NC}"

# ── LANGKAH 1: Copy file yang diperbarui ke project ──
echo -e "\n${YELLOW}[1/5] Menyalin file yang diperbarui...${NC}"
echo "   → Pastikan Anda sudah copy App.tsx, package.json, dan vite.config.ts"
echo "     ke folder src/ (App.tsx) dan root project (package.json, vite.config.ts)"

# ── LANGKAH 2: Install ulang dependensi (tanpa PDF) ──
echo -e "\n${YELLOW}[2/5] Install ulang dependensi (node_modules)...${NC}"
npm install
echo -e "${GREEN}   ✓ npm install selesai${NC}"

# ── LANGKAH 3: Pilihan — localhost atau GitHub ──
echo -e "\n${YELLOW}[3/5] Pilih mode deploy:${NC}"
echo "   [1] Jalankan di localhost (npm run dev)"
echo "   [2] Build + Push ke GitHub (git push origin master)"
echo "   [3] Keduanya (localhost dulu, lalu push setelah selesai)"
echo ""
read -rp "Masukkan pilihan (1/2/3): " CHOICE

# ── LANGKAH 4: Eksekusi ──
case "$CHOICE" in
  1)
    echo -e "\n${YELLOW}[4/5] Menjalankan di localhost...${NC}"
    echo -e "${GREEN}   → Buka browser: http://localhost:5173${NC}"
    npm run dev
    ;;

  2)
    echo -e "\n${YELLOW}[4/5] Build production...${NC}"
    npm run build
    echo -e "${GREEN}   ✓ Build selesai (folder dist/)${NC}"

    echo -e "\n${YELLOW}[5/5] Push ke GitHub...${NC}"
    read -rp "Masukkan pesan commit [default: 'hapus fitur PDF']: " COMMIT_MSG
    COMMIT_MSG="${COMMIT_MSG:-hapus fitur PDF}"

    git add .
    git commit -m "$COMMIT_MSG"
    git push origin master
    echo -e "${GREEN}   ✓ Push ke GitHub berhasil!${NC}"
    ;;

  3)
    echo -e "\n${YELLOW}[4/5] Menjalankan di localhost terlebih dahulu...${NC}"
    echo -e "${CYAN}   → Tekan Ctrl+C untuk menghentikan server, lalu push otomatis dilanjutkan${NC}"
    npm run dev || true

    echo -e "\n${YELLOW}[5/5] Build + Push ke GitHub...${NC}"
    npm run build
    echo -e "${GREEN}   ✓ Build selesai${NC}"

    read -rp "Masukkan pesan commit [default: 'hapus fitur PDF']: " COMMIT_MSG
    COMMIT_MSG="${COMMIT_MSG:-hapus fitur PDF}"

    git add .
    git commit -m "$COMMIT_MSG"
    git push origin master
    echo -e "${GREEN}   ✓ Push ke GitHub berhasil!${NC}"
    ;;

  *)
    echo -e "${RED}Pilihan tidak valid. Jalankan script lagi.${NC}"
    exit 1
    ;;
esac

echo -e "\n${GREEN}========================================${NC}"
echo -e "${GREEN}  Selesai!${NC}"
echo -e "${GREEN}========================================${NC}"
