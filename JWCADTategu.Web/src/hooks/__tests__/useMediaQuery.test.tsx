import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMediaQuery, useIsMobile } from '../useMediaQuery';

const createMockMatchMedia = (matches: boolean) => {
  const listeners: ((e: MediaQueryListEvent) => void)[] = [];
  const mql = {
    matches,
    media: '',
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn((_, cb) => listeners.push(cb)),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
    _listeners: listeners,
    _triggerChange: (newMatches: boolean) => {
      listeners.forEach(cb => cb({ matches: newMatches } as MediaQueryListEvent));
    },
  };
  return mql;
};

describe('useMediaQuery', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('初期値としてmatchMedia.matchesを返す（false）', () => {
    const mockMql = createMockMatchMedia(false);
    vi.spyOn(window, 'matchMedia').mockReturnValue(mockMql as any);

    const { result } = renderHook(() => useMediaQuery('(max-width: 768px)'));
    expect(result.current).toBe(false);
  });

  it('初期値としてmatchMedia.matchesを返す（true）', () => {
    const mockMql = createMockMatchMedia(true);
    vi.spyOn(window, 'matchMedia').mockReturnValue(mockMql as any);

    const { result } = renderHook(() => useMediaQuery('(max-width: 768px)'));
    expect(result.current).toBe(true);
  });

  it('メディアクエリ変更時に値を更新する', () => {
    const mockMql = createMockMatchMedia(false);
    vi.spyOn(window, 'matchMedia').mockReturnValue(mockMql as any);

    const { result } = renderHook(() => useMediaQuery('(max-width: 768px)'));
    expect(result.current).toBe(false);

    act(() => {
      mockMql._triggerChange(true);
    });

    expect(result.current).toBe(true);
  });

  it('アンマウント時にaddEventListenerのリスナーを解除する', () => {
    const mockMql = createMockMatchMedia(false);
    vi.spyOn(window, 'matchMedia').mockReturnValue(mockMql as any);

    const { unmount } = renderHook(() => useMediaQuery('(max-width: 768px)'));
    unmount();

    expect(mockMql.removeEventListener).toHaveBeenCalled();
  });
});

describe('useIsMobile', () => {
  it('(max-width: 768px) クエリで動作する', () => {
    const mockMql = createMockMatchMedia(true);
    vi.spyOn(window, 'matchMedia').mockImplementation((query) => {
      expect(query).toBe('(max-width: 768px)');
      return mockMql as any;
    });

    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(true);
  });
});
