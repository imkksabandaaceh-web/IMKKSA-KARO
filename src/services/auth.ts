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
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error(err);
    }
    localStorage.removeItem('isIMKKSAAdmin');
    localStorage.removeItem('adminToken');
  },
  
  isAuthenticated: (): boolean => {
    return localStorage.getItem('isIMKKSAAdmin') === 'true';
  }
};
