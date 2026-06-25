@echo off
echo ============================================
echo  KARO - Build ^& Deploy Script
echo ============================================

echo.
echo [1/3] Installing dependencies...
npm install
if %errorlevel% neq 0 (
    echo ERROR: npm install gagal!
    pause
    exit /b 1
)

echo.
echo [2/3] Building project (vite build)...
npm run build
if %errorlevel% neq 0 (
    echo ERROR: Build gagal! Cek error di atas.
    pause
    exit /b 1
)

echo.
echo [3/3] Pushing ke GitHub...
git add .
git commit -m "perf: optimize vite config - code splitting & chunking"
git push origin master
if %errorlevel% neq 0 (
    echo ERROR: Git push gagal! Cek koneksi atau credentials.
    pause
    exit /b 1
)

echo.
echo ============================================
echo  SUKSES! Deploy selesai.
echo  Vercel akan auto-deploy dari GitHub.
echo ============================================
pause
