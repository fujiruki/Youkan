import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { YoukanSpeechSynthesis } from '../speechSynthesis';

const setupSpeechSynthesisMock = () => {
  const speakSpy = vi.fn();
  const pauseSpy = vi.fn();
  const resumeSpy = vi.fn();
  const cancelSpy = vi.fn();

  Object.defineProperty(window, 'speechSynthesis', {
    writable: true,
    value: {
      speak: speakSpy,
      pause: pauseSpy,
      resume: resumeSpy,
      cancel: cancelSpy,
      speaking: false,
      pending: false,
      paused: false,
    },
  });

  return { speakSpy, pauseSpy, resumeSpy, cancelSpy };
};

describe('YoukanSpeechSynthesis', () => {
  let instance: YoukanSpeechSynthesis;

  beforeEach(() => {
    setupSpeechSynthesisMock();
    instance = new YoukanSpeechSynthesis();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('isSupported', () => {
    it('speechSynthesisが存在する場合trueを返す', () => {
      expect(instance.isSupported()).toBe(true);
    });

    it('speechSynthesisがない場合falseを返す', () => {
      Object.defineProperty(window, 'speechSynthesis', {
        writable: true,
        value: undefined,
      });
      const inst = new YoukanSpeechSynthesis();
      expect(inst.isSupported()).toBe(false);
    });
  });

  describe('speak', () => {
    it('window.speechSynthesis.speakを呼び出す', () => {
      const { speakSpy } = setupSpeechSynthesisMock();
      instance = new YoukanSpeechSynthesis();
      instance.speak('こんにちは');
      expect(speakSpy).toHaveBeenCalledTimes(1);
      expect(speakSpy).toHaveBeenCalledWith(expect.any(SpeechSynthesisUtterance));
    });

    it('言語デフォルトはja-JPが設定される', () => {
      const { speakSpy } = setupSpeechSynthesisMock();
      instance = new YoukanSpeechSynthesis();
      instance.speak('テスト');
      const utterance: SpeechSynthesisUtterance = speakSpy.mock.calls[0][0];
      expect(utterance.lang).toBe('ja-JP');
    });

    it('カスタム言語を指定できる', () => {
      const { speakSpy } = setupSpeechSynthesisMock();
      instance = new YoukanSpeechSynthesis();
      instance.speak('Hello', { lang: 'en-US' });
      const utterance: SpeechSynthesisUtterance = speakSpy.mock.calls[0][0];
      expect(utterance.lang).toBe('en-US');
    });

    it('連続speak時は毎回cancelを呼んでからspeakする', () => {
      const { cancelSpy, speakSpy } = setupSpeechSynthesisMock();
      instance = new YoukanSpeechSynthesis();
      instance.speak('1回目');
      instance.speak('2回目');
      expect(cancelSpy).toHaveBeenCalledTimes(2);
      expect(speakSpy).toHaveBeenCalledTimes(2);
    });

    it('onEndコールバックが発火する', () => {
      const { speakSpy } = setupSpeechSynthesisMock();
      instance = new YoukanSpeechSynthesis();
      const onEnd = vi.fn();
      instance.speak('テスト', { onEnd });
      const utterance: SpeechSynthesisUtterance = speakSpy.mock.calls[0][0];
      utterance.onend?.({} as SpeechSynthesisEvent);
      expect(onEnd).toHaveBeenCalledTimes(1);
    });

    it('onStartコールバックが発火する', () => {
      const { speakSpy } = setupSpeechSynthesisMock();
      instance = new YoukanSpeechSynthesis();
      const onStart = vi.fn();
      instance.speak('テスト', { onStart });
      const utterance: SpeechSynthesisUtterance = speakSpy.mock.calls[0][0];
      utterance.onstart?.({} as SpeechSynthesisEvent);
      expect(onStart).toHaveBeenCalledTimes(1);
    });

    it('onErrorコールバックが発火する', () => {
      const { speakSpy } = setupSpeechSynthesisMock();
      instance = new YoukanSpeechSynthesis();
      const onError = vi.fn();
      instance.speak('テスト', { onError });
      const utterance: SpeechSynthesisUtterance = speakSpy.mock.calls[0][0];
      utterance.onerror?.({ error: 'canceled' } as SpeechSynthesisErrorEvent);
      expect(onError).toHaveBeenCalledTimes(1);
    });

    it('rateとpitchとvolumeが設定される', () => {
      const { speakSpy } = setupSpeechSynthesisMock();
      instance = new YoukanSpeechSynthesis();
      instance.speak('テスト', { rate: 1.5, pitch: 0.8, volume: 0.5 });
      const utterance: SpeechSynthesisUtterance = speakSpy.mock.calls[0][0];
      expect(utterance.rate).toBe(1.5);
      expect(utterance.pitch).toBe(0.8);
      expect(utterance.volume).toBe(0.5);
    });
  });

  describe('pause / resume / stop', () => {
    it('pauseを呼び出す', () => {
      const { pauseSpy } = setupSpeechSynthesisMock();
      instance = new YoukanSpeechSynthesis();
      instance.pause();
      expect(pauseSpy).toHaveBeenCalledTimes(1);
    });

    it('resumeを呼び出す', () => {
      const { resumeSpy } = setupSpeechSynthesisMock();
      instance = new YoukanSpeechSynthesis();
      instance.resume();
      expect(resumeSpy).toHaveBeenCalledTimes(1);
    });

    it('stopはcancelを呼び出す', () => {
      const { cancelSpy } = setupSpeechSynthesisMock();
      instance = new YoukanSpeechSynthesis();
      instance.stop();
      expect(cancelSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('isSpeaking', () => {
    it('speechSynthesis.speakingの値を返す', () => {
      Object.defineProperty(window, 'speechSynthesis', {
        writable: true,
        value: {
          speak: vi.fn(),
          pause: vi.fn(),
          resume: vi.fn(),
          cancel: vi.fn(),
          speaking: true,
          pending: false,
          paused: false,
        },
      });
      instance = new YoukanSpeechSynthesis();
      expect(instance.isSpeaking()).toBe(true);
    });
  });
});
