import { useState, useRef, useCallback } from 'react';
import { YoukanSpeechSynthesis } from '../logic/speechSynthesis';

export interface UseSpeechSynthesisReturn {
  isSpeaking: boolean;
  isPaused: boolean;
  isSupported: boolean;
  speak: (text: string, onEnd?: () => void) => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
}

export function useSpeechSynthesis(): UseSpeechSynthesisReturn {
  const synthRef = useRef<YoukanSpeechSynthesis>(new YoukanSpeechSynthesis());
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  const speak = useCallback((text: string, onEnd?: () => void) => {
    synthRef.current.speak(text, {
      onStart: () => {
        setIsSpeaking(true);
        setIsPaused(false);
      },
      onEnd: () => {
        setIsSpeaking(false);
        setIsPaused(false);
        onEnd?.();
      },
      onError: () => {
        setIsSpeaking(false);
        setIsPaused(false);
      },
    });
  }, []);

  const pause = useCallback(() => {
    synthRef.current.pause();
    setIsPaused(true);
  }, []);

  const resume = useCallback(() => {
    synthRef.current.resume();
    setIsPaused(false);
  }, []);

  const stop = useCallback(() => {
    synthRef.current.stop();
    setIsSpeaking(false);
    setIsPaused(false);
  }, []);

  return {
    isSpeaking,
    isPaused,
    isSupported: synthRef.current.isSupported(),
    speak,
    pause,
    resume,
    stop,
  };
}
