export interface SpeakConfig {
  lang?: string;
  rate?: number;
  pitch?: number;
  volume?: number;
  onEnd?: () => void;
  onStart?: () => void;
  onError?: (e: SpeechSynthesisErrorEvent) => void;
}

export class YoukanSpeechSynthesis {
  isSupported(): boolean {
    return typeof window !== 'undefined' && 'speechSynthesis' in window && !!window.speechSynthesis;
  }

  isSpeaking(): boolean {
    if (!this.isSupported()) return false;
    return window.speechSynthesis.speaking;
  }

  speak(text: string, config: SpeakConfig = {}): void {
    if (!this.isSupported()) return;

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = config.lang ?? 'ja-JP';
    if (config.rate !== undefined) utterance.rate = config.rate;
    if (config.pitch !== undefined) utterance.pitch = config.pitch;
    if (config.volume !== undefined) utterance.volume = config.volume;

    if (config.onStart) utterance.onstart = () => config.onStart!();
    if (config.onEnd) utterance.onend = () => config.onEnd!();
    if (config.onError) utterance.onerror = (e) => config.onError!(e);

    window.speechSynthesis.speak(utterance);
  }

  pause(): void {
    if (!this.isSupported()) return;
    window.speechSynthesis.pause();
  }

  resume(): void {
    if (!this.isSupported()) return;
    window.speechSynthesis.resume();
  }

  stop(): void {
    if (!this.isSupported()) return;
    window.speechSynthesis.cancel();
  }
}
