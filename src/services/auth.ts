import { supabase } from './supabase';

export interface AuthResponse {
  success: boolean;
  message?: string;
  token?: string;
}

export const authService = {
  login: async (username: string, password: string): Promise<AuthResponse> => {
    try {
      console.log('[DEBUG] Memulai login untuk:', username);
      // If it looks like an email, use it directly. Otherwise, map to the legacy format.
      const email = username.includes('@') ? username : `${username}@imkksa.org`;
      console.log('[DEBUG] Target email Supabase:', email);
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error('[DEBUG] Supabase Auth Error:', error.message, '| Code:', error.status);
        return { 
          success: false, 
          message: `Login Gagal: ${error.message}` 
        };
      }

      localStorage.setItem('isIMKKSAAdmin', 'true');
      localStorage.setItem('adminToken', data.session?.access_token || 'true');
      return { 
        success: true, 
        token: data.session?.access_token 
      };
    } catch (err) {
      console.error(err);
      return { 
        success: false, 
        message: 'Gagal menghubungkan ke server. Periksa koneksi internet Anda.' 
      };
    }
  },
  
  logout: async () => {
    // 1) Mulai revoke token di server (best-effort). Sesi masih ada di storage
    //    saat panggilan ini dimulai, jadi token bisa dibaca untuk revoke.
    const signOutPromise = supabase.auth.signOut().catch((err) => {
      console.error('Revoke token server gagal (abaikan):', err);
    });

    // 2) Hapus sesi lokal SEKARANG, sinkron, tanpa menunggu jaringan.
    //    (signOut() bawaan menghapus sesi lokal HANYA SETELAH panggilan server
    //    selesai — kalau pengguna refresh di tengah jalan, sesi malah tersisa.
    //    Di sini key sesi supabase-js dihapus langsung supaya refresh setelah
    //    logout PASTI tetap logout.)
    localStorage.removeItem('isIMKKSAAdmin');
    localStorage.removeItem('adminToken');
    Object.keys(localStorage)
      .filter((k) => k.startsWith('sb-'))
      .forEach((k) => localStorage.removeItem(k));

    await signOutPromise;
  },

  /**
   * Pulihkan sesi admin saat halaman dimuat ulang (refresh).
   * supabase-js otomatis menyimpan sesi di localStorage, jadi tinggal dibaca
   * (cepat, tanpa jaringan) — refresh tidak lagi meng-out admin secara otomatis.
   */
  restoreSession: async (): Promise<boolean> => {
    try {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        localStorage.setItem('isIMKKSAAdmin', 'true');
        localStorage.setItem('adminToken', data.session.access_token || 'true');
        return true;
      }
      return false;
    } catch (err) {
      console.error('Gagal memulihkan sesi admin:', err);
      return false;
    }
  },

  isAuthenticated: (): boolean => {
    return localStorage.getItem('isIMKKSAAdmin') === 'true';
  }
};
