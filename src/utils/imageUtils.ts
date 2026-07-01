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
 * Konversi URL lh3.googleusercontent.com -> ImageKit proxy.
 * Jika ImageKit belum dikonfigurasi, gunakan format asli.
 */
export const toImageKitUrl = (url: string | undefined | null, width = 800): string => {
  if (!url) return '';
  const endpoint = import.meta.env.VITE_IMAGEKIT_ENDPOINT as string | undefined;
  if (endpoint && url.includes('https://lh3.googleusercontent.com')) {
    const cleanUrl = url.split('?')[0];
    return `${cleanUrl.replace('https://lh3.googleusercontent.com', endpoint)}?tr=w-${width},q-80`;
  }
  return url;
};
