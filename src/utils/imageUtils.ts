/**
 * Kompresi gambar base64
 * @param base64Str String base64 asli
 * @param maxWidth Lebar maksimum gambar (default 800px)
 * @param quality Kualitas kompresi (0.1 - 1.0)
 * @returns Promise<string> string base64 yang sudah dikompresi
 */
export const compressImage = (base64Str: string, maxWidth = 800, quality = 0.7): Promise<string> => {
  return new Promise((resolve) => {
    // Jika bukan base64 image, langsung kembalikan
    if (!base64Str.startsWith('data:image')) {
      resolve(base64Str);
      return;
    }

    const img = new Image();
    img.src = base64Str;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      // Hitung proporsi jika lebar melebihi batas
      if (width > maxWidth) {
        height = (maxWidth / width) * height;
        width = maxWidth;
      }

      canvas.width = width;
      canvas.height = height;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(base64Str);
        return;
      }

      // Gambar ulang ke canvas dengan ukuran baru
      ctx.drawImage(img, 0, 0, width, height);
      
      // Export ke JPEG dengan kualitas yang ditentukan
      // JPEG lebih efisien untuk foto daripada PNG
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => {
      resolve(base64Str);
    };
  });
};

/**
 * Kompresi khusus pas foto 4x6 (rasio 2:3).
 * Foto di-crop dari tengah ke rasio 4x6, diperkecil ke 300x450 px, lalu
 * disimpan sebagai JPEG kualitas 0.6 — jauh lebih kecil dari foto kamera
 * sehingga hemat kapasitas Google Drive/ImageKit.
 * @param base64Str String base64 asli
 * @param width Lebar akhir pas foto (tinggi otomatis 1.5x = 4x6)
 * @param quality Kualitas JPEG (0.1 - 1.0)
 */
export const compressToPassportPhoto = (base64Str: string, width = 300, quality = 0.6): Promise<string> => {
  return new Promise((resolve) => {
    if (!base64Str.startsWith('data:image')) {
      resolve(base64Str);
      return;
    }

    const img = new Image();
    img.src = base64Str;
    img.onload = () => {
      const targetWidth = width;
      const targetHeight = Math.round(width * 1.5); // 4x6 → 2:3
      const targetRatio = targetWidth / targetHeight;

      // Ambil area terbesar yang rasionya 2:3, dipotong dari tengah
      let sourceWidth = img.width;
      let sourceHeight = img.height;
      let sourceX = 0;
      let sourceY = 0;
      if (sourceWidth / sourceHeight > targetRatio) {
        sourceWidth = Math.round(sourceHeight * targetRatio);
        sourceX = Math.round((img.width - sourceWidth) / 2);
      } else {
        sourceHeight = Math.round(sourceWidth / targetRatio);
        sourceY = Math.round((img.height - sourceHeight) / 2);
      }

      const canvas = document.createElement('canvas');
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(base64Str);
        return;
      }

      ctx.drawImage(img, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, targetWidth, targetHeight);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => {
      resolve(base64Str);
    };
  });
};

/**
 * Konversi URL Google Drive/lh3.googleusercontent.com -> ImageKit proxy.
 * Jika ImageKit belum dikonfigurasi, gunakan format asli.
 */
export const toImageKitUrl = (url: string | undefined | null, width = 800, cropFace = false): string => {
  if (!url) return '';
  const endpoint = (import.meta.env.VITE_IMAGEKIT_ENDPOINT as string | undefined) || 'https://ik.imagekit.io/imkksa';
  
  const tr = cropFace ? `tr=w-${width},h-${width},fo-face,f-auto` : `tr=w-${width},q-80,f-auto`;

  if (url.includes('ik.imagekit.io')) {
    const cleanUrl = url.split('?')[0];
    return `${cleanUrl}?${tr}`;
  }

  let fileId = '';
  const lhMatch = url.match(/lh\d+\.googleusercontent\.com\/(?:u\/\d+\/)?d\/([a-zA-Z0-9_-]+)/);
  if (lhMatch) {
    fileId = lhMatch[1];
  } else {
    const driveIdMatch = url.match(/drive\.google\.com\/.*[?&]id=([a-zA-Z0-9_-]+)/);
    if (driveIdMatch) {
      fileId = driveIdMatch[1];
    } else {
      const drivePathMatch = url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
      if (drivePathMatch) {
        fileId = drivePathMatch[1];
      }
    }
  }

  if (fileId && endpoint) {
    return `${endpoint}/d/${fileId}?${tr}`;
  }

  if (endpoint && url.includes('https://lh3.googleusercontent.com')) {
    const cleanUrl = url.split('?')[0];
    return `${cleanUrl.replace('https://lh3.googleusercontent.com', endpoint)}?${tr}`;
  }

  return url;
};
