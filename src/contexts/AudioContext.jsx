import React, { createContext, useContext, useState, useCallback, useRef } from 'react';

const AudioContext = createContext();

export function useAudio() {
  return useContext(AudioContext);
}

export function AudioProvider({ children }) {
  const [isMuted, setIsMuted] = useState(false);
  const audioCtxRef = useRef(null);

  const toggleMute = () => setIsMuted((prev) => !prev);

  const getAudioContext = () => {
    if (!audioCtxRef.current) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        audioCtxRef.current = new AudioCtx();
      }
    }
    if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
    return audioCtxRef.current;
  };

  const playTone = useCallback((freq, type, duration, startTimeOffset = 0, volume = 0.1) => {
    if (isMuted) return;
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      
      const t = ctx.currentTime + startTimeOffset;
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, t);

      // Simple ADSR Envelope for pleasant clicks
      gainNode.gain.setValueAtTime(0, t);
      gainNode.gain.linearRampToValueAtTime(volume, t + 0.05); // Attack
      gainNode.gain.exponentialRampToValueAtTime(0.001, t + duration); // Decay
      
      osc.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      osc.start(t);
      osc.stop(t + duration);
    } catch (e) {
      console.warn("Audio element failed to play", e);
    }
  }, [isMuted]);

  const playSuccess = useCallback(() => {
    if (isMuted) return;
    // Pleasant double chime: C5 -> E5 -> G5 sequence
    playTone(523.25, 'sine', 0.15, 0, 0.2); // C5
    playTone(659.25, 'sine', 0.2, 0.08, 0.2); // E5
    playTone(783.99, 'sine', 0.3, 0.18, 0.25); // G5 
  }, [isMuted, playTone]);

  const playWarning = useCallback(() => {
    if (isMuted) return;
    // Urgent dual tone alert: F4 -> F4 dropping pitch slightly
    playTone(349.23, 'sawtooth', 0.2, 0, 0.2);
    playTone(329.63, 'sawtooth', 0.4, 0.2, 0.2);
  }, [isMuted, playTone]);

  return (
    <AudioContext.Provider value={{ isMuted, toggleMute, playSuccess, playWarning }}>
      {children}
    </AudioContext.Provider>
  );
}
