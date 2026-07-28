
import React, { useState } from 'react';
import { authService } from '../services/auth';

interface LoginFormProps {
  onLoginSuccess: () => void;
}

const LoginForm: React.FC<LoginFormProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const response = await authService.login(username, password);
      
      if (response.success) {
        onLoginSuccess();
      } else {
        setError(response.message || 'Terjadi kesalahan saat login.');
      }
    } catch (err) {
      setError('Gagal menghubungkan ke server. Periksa koneksi internet Anda.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-container">
      <h2>Login Admin</h2>
      
      {error && (
        <div style={{ 
          backgroundColor: '#ffebee', 
          color: '#c62828', 
          padding: '10px', 
          borderRadius: '4px', 
          marginBottom: '20px',
          fontSize: '0.9rem',
          textAlign: 'center',
          border: '1px solid #ffcdd2'
        }}>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <input 
            type="text" 
            placeholder="Username" 
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            disabled={isLoading}
            required 
            autoComplete="username"
          />
        </div>
        
        <div className="form-group password-input-wrapper" style={{ position: 'relative' }}>
          <input 
            type={showPassword ? "text" : "password"} 
            placeholder="Password" 
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isLoading}
            required 
            autoComplete="current-password"
            style={{ width: '100%', paddingRight: '45px', boxSizing: 'border-box' }}
          />
          <button 
            type="button" 
            className="toggle-password-btn"
            onClick={() => setShowPassword(!showPassword)}
            style={{
              position: 'absolute',
              right: '10px',
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '5px',
              fontSize: '1.2rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 2,
              width: 'auto',
              marginTop: 0
            }}
            title={showPassword ? "Sembunyikan Password" : "Tampilkan Password"}
            disabled={isLoading}
          >
            {showPassword ? '👁️‍🗨️' : '👁️'}
          </button>
        </div>
        
        <button type="submit" disabled={isLoading} style={{ width: '100%', marginTop: '10px' }}>
          {isLoading ? (
            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              <span className="loader-small"></span> Memproses...
            </span>
          ) : 'Masuk'}
        </button>
      </form>
    </div>
  );
};

export default LoginForm;
