import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSpeechSynthesis } from '../useSpeechSynthesis';

const createMockSpeechSynthesis = () => {
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

describe('useSpeechSynthesis', () => {
  beforeEach(() => {
    createMockSpeechSynthesis();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('初期状態はisSpeaking=false, isPaused=false', () => {
    const { result } = renderHook(() => useSpeechSynthesis());
    expect(result.current.isSpeaking).toBe(false);
    expect(result.current.isPaused).toBe(false);
  });

  it('isSupportedがtrueを返す（speechSynthesisが存在する場合）', () => {
    const { result } = renderHook(() => useSpeechSynthesis());
    expect(result.current.isSupported).toBe(true);
  });

  it('speak関数が呼び出せる', () => {
    const { speakSpy } = createMockSpeechSynthesis();
    const { result } = renderHook(() => useSpeechSynthesis());

    act(() => {
      result.current.speak('テストテキスト');
    });

    expect(speakSpy).toHaveBeenCalledTimes(1);
  });

  it('speak時にisSpeakingがtrueになる', () => {
    const { speakSpy } = createMockSpeechSynthesis();
    const { result } = renderHook(() => useSpeechSynthesis());

    act(() => {
      result.current.speak('テスト', () => {});
      const utterance: SpeechSynthesisUtterance = speakSpy.mock.calls[0][0];
      utterance.onstart?.({} as SpeechSynthesisEvent);
    });

    expect(result.current.isSpeaking).toBe(true);
  });

  it('onEnd発火後にisSpeakingがfalseになる', () => {
    const { speakSpy } = createMockSpeechSynthesis();
    const { result } = renderHook(() => useSpeechSynthesis());

    act(() => {
      result.current.speak('テスト');
      const utterance: SpeechSynthesisUtterance = speakSpy.mock.calls[0][0];
      utterance.onstart?.({} as SpeechSynthesisEvent);
    });

    expect(result.current.isSpeaking).toBe(true);

    act(() => {
      const utterance: SpeechSynthesisUtterance = speakSpy.mock.calls[0][0];
      utterance.onend?.({} as SpeechSynthesisEvent);
    });

    expect(result.current.isSpeaking).toBe(false);
  });

  it('pause関数を呼び出すとisPausedがtrueになる', () => {
    const { result } = renderHook(() => useSpeechSynthesis());

    act(() => {
      result.current.pause();
    });

    expect(result.current.isPaused).toBe(true);
  });

  it('resume関数を呼び出すとisPausedがfalseになる', () => {
    const { result } = renderHook(() => useSpeechSynthesis());

    act(() => {
      result.current.pause();
    });
    expect(result.current.isPaused).toBe(true);

    act(() => {
      result.current.resume();
    });
    expect(result.current.isPaused).toBe(false);
  });

  it('stop関数を呼び出すとisSpeakingとisPausedがfalseになる', () => {
    const { speakSpy } = createMockSpeechSynthesis();
    const { result } = renderHook(() => useSpeechSynthesis());

    act(() => {
      result.current.speak('テスト');
      const utterance: SpeechSynthesisUtterance = speakSpy.mock.calls[0][0];
      utterance.onstart?.({} as SpeechSynthesisEvent);
    });

    act(() => {
      result.current.stop();
    });

    expect(result.current.isSpeaking).toBe(false);
    expect(result.current.isPaused).toBe(false);
  });

  it('speak時のonEndコールバックが呼ばれる', () => {
    const { speakSpy } = createMockSpeechSynthesis();
    const { result } = renderHook(() => useSpeechSynthesis());
    const onEnd = vi.fn();

    act(() => {
      result.current.speak('テスト', onEnd);
    });

    act(() => {
      const utterance: SpeechSynthesisUtterance = speakSpy.mock.calls[0][0];
      utterance.onend?.({} as SpeechSynthesisEvent);
    });

    expect(onEnd).toHaveBeenCalledTimes(1);
  });
});
