import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * BackgroundMusic — pemutar musik latar yang ringan.
 *
 * Strategi loading:
 *  1. Tag <audio> menggunakan preload="none" supaya browser TIDAK mengunduh
 *     file MP3 saat halaman pertama kali dibuka (TTFB / FCP tetap cepat).
 *  2. Unduhan hanya dimulai ketika user mengklik tombol Play (interaksi pertama).
 *  3. Preferensi (play/mute) disimpan di localStorage agar kunjungan
 *     berikutnya langsung melanjutkan sesuai keinginan user.
 */

const AUDIO_SRC = '/1Mejuah-juah.mp3';
const STORAGE_KEY = 'imkksa_bgmusic';

interface BgMusicState {
  playing: boolean;
  muted: boolean;
}

const loadState = (): BgMusicState => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return { playing: false, muted: false };
};

const saveState = (s: BgMusicState) => {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch { /* ignore */ }
};

export default function BackgroundMusic() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [state, setState] = useState<BgMusicState>(loadState);


  // Buat elemen <audio> secara manual agar kita bisa mengontrol preload
  useEffect(() => {
    const audio = new Audio();
    audio.src = AUDIO_SRC;
    audio.loop = true;
    audio.preload = 'none';   // ← kunci: jangan auto-download
    audio.volume = state.muted ? 0 : 0.35;
    audioRef.current = audio;



    return () => {
      audio.pause();
      audio.src = '';
      audioRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync state.playing dengan elemen audio
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (state.playing) {
      audio.play().catch(() => {
        // Browser memblokir auto-play — reset state
        setState(prev => {
          const next = { ...prev, playing: false };
          saveState(next);
          return next;
        });
      });
    } else {
      audio.pause();
    }
  }, [state.playing]);

  // Sync state.muted
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = state.muted ? 0 : 0.35;
  }, [state.muted]);

  const togglePlay = useCallback(() => {
    setState(prev => {
      const next = { ...prev, playing: !prev.playing };
      saveState(next);
      return next;
    });
  }, []);

  const toggleMute = useCallback(() => {
    setState(prev => {
      const next = { ...prev, muted: !prev.muted };
      saveState(next);
      return next;
    });
  }, []);

  // Jangan render apapun kalau user belum pernah interact (preferensi default: hidden)
  // TAPI tetap tampilkan tombol supaya user tahu ada musik
  return (
    <div
      style={{
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        background: 'rgba(255,255,255,0.92)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        borderRadius: '50px',
        padding: '6px 14px 6px 10px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
        border: '1px solid rgba(0,0,0,0.06)',
        transition: 'all 0.25s ease',
        cursor: 'pointer',
        userSelect: 'none',
      }}
      onClick={togglePlay}
      title={state.playing ? 'Pause musik latar' : 'Putar musik latar'}
      role="button"
      aria-label={state.playing ? 'Pause musik latar' : 'Putar musik latar'}
    >
      {/* Ikon Play / Pause */}
      <span style={{ fontSize: '20px', lineHeight: 1 }}>
        {state.playing ? '⏸️' : '🎵'}
      </span>

      {/* Label */}
      <span
        style={{
          fontSize: '12px',
          fontWeight: 600,
          color: '#2e7d32',
          letterSpacing: '0.02em',
          whiteSpace: 'nowrap',
        }}
      >
        {state.playing ? 'Pause' : 'Putar Musik'}
      </span>

      {/* Tombol Mute (hanya tampil saat musik aktif) */}
      {state.playing && (
        <span
          onClick={(e) => {
            e.stopPropagation();
            toggleMute();
          }}
          style={{
            fontSize: '16px',
            marginLeft: '4px',
            opacity: 0.7,
            transition: 'opacity 0.2s',
          }}
          title={state.muted ? 'Unmute' : 'Mute'}
          role="button"
          aria-label={state.muted ? 'Unmute' : 'Mute'}
        >
          {state.muted ? '🔇' : '🔊'}
        </span>
      )}

      {/* Audio element (hidden) */}
      {/* Kita tidak render <audio> di JSX — sudah di-handle via ref di atas */}
    </div>
  );
}
