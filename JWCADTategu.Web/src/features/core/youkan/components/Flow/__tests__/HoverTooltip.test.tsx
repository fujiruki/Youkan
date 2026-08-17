import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { HoverTooltip } from '../HoverTooltip';

// R-116: フロー操作パネルのホバーツールチップ（1000ms hoverで表示、離すと即消灯）
describe('HoverTooltip', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const renderWithButton = () => {
    render(
      <HoverTooltip label="ヒント文言">
        <button>対象ボタン</button>
      </HoverTooltip>
    );
    return screen.getByText('対象ボタン').parentElement!;
  };

  it('初期状態ではツールチップは表示されない', () => {
    renderWithButton();
    expect(screen.queryByText('ヒント文言')).toBeNull();
  });

  it('mouseEnterから1000ms経過するとツールチップが表示される', () => {
    const wrapper = renderWithButton();

    fireEvent.mouseEnter(wrapper);
    expect(screen.queryByText('ヒント文言')).toBeNull();

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByText('ヒント文言')).toBeInTheDocument();
  });

  it('1000ms経過前にmouseLeaveするとタイマーがクリアされ表示されない', () => {
    const wrapper = renderWithButton();

    fireEvent.mouseEnter(wrapper);
    act(() => {
      vi.advanceTimersByTime(500);
    });
    fireEvent.mouseLeave(wrapper);
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.queryByText('ヒント文言')).toBeNull();
  });

  it('表示中にmouseLeaveすると即座に消える', () => {
    const wrapper = renderWithButton();

    fireEvent.mouseEnter(wrapper);
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByText('ヒント文言')).toBeInTheDocument();

    fireEvent.mouseLeave(wrapper);
    expect(screen.queryByText('ヒント文言')).toBeNull();
  });

  it('1000ms経過前にmouseDownするとタイマーがクリアされ表示されない', () => {
    const wrapper = renderWithButton();

    fireEvent.mouseEnter(wrapper);
    act(() => {
      vi.advanceTimersByTime(500);
    });
    fireEvent.mouseDown(wrapper);
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.queryByText('ヒント文言')).toBeNull();
  });
});
