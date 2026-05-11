import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MobileBottomSheet } from '../MobileBottomSheet';

vi.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement> & { children?: React.ReactNode }) => (
      <div {...props}>{children}</div>
    ),
  },
}));

describe('MobileBottomSheet', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    document.body.style.touchAction = '';
  });

  it('isOpen=false のとき何も表示されない', () => {
    render(
      <MobileBottomSheet isOpen={false} onClose={vi.fn()}>
        <div>コンテンツ</div>
      </MobileBottomSheet>
    );
    expect(screen.queryByText('コンテンツ')).toBeNull();
  });

  it('isOpen=true のとき children が表示される', () => {
    render(
      <MobileBottomSheet isOpen={true} onClose={vi.fn()}>
        <div>テストコンテンツ</div>
      </MobileBottomSheet>
    );
    expect(screen.getByText('テストコンテンツ')).toBeInTheDocument();
  });

  it('title 設定時にタイトルと閉じるボタンが表示される', () => {
    render(
      <MobileBottomSheet isOpen={true} onClose={vi.fn()} title="テストタイトル">
        <div>コンテンツ</div>
      </MobileBottomSheet>
    );
    expect(screen.getByText('テストタイトル')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '閉じる' })).toBeInTheDocument();
  });

  it('閉じるボタンクリックで onClose が呼ばれる', () => {
    const onClose = vi.fn();
    render(
      <MobileBottomSheet isOpen={true} onClose={onClose} title="タイトル">
        <div>コンテンツ</div>
      </MobileBottomSheet>
    );
    fireEvent.click(screen.getByRole('button', { name: '閉じる' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('背景オーバーレイクリックで onClose が呼ばれる', () => {
    const onClose = vi.fn();
    render(
      <MobileBottomSheet isOpen={true} onClose={onClose}>
        <div>コンテンツ</div>
      </MobileBottomSheet>
    );
    const overlay = screen.getByRole('presentation', { hidden: true });
    fireEvent.click(overlay);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Esc キーで onClose が呼ばれる', () => {
    const onClose = vi.fn();
    render(
      <MobileBottomSheet isOpen={true} onClose={onClose}>
        <div>コンテンツ</div>
      </MobileBottomSheet>
    );
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('role="dialog" と aria-modal="true" が設定されている', () => {
    render(
      <MobileBottomSheet isOpen={true} onClose={vi.fn()}>
        <div>コンテンツ</div>
      </MobileBottomSheet>
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });

  it('isOpen=true 時 body の touch-action が none になる、close 時に戻る', () => {
    const { rerender } = render(
      <MobileBottomSheet isOpen={true} onClose={vi.fn()}>
        <div>コンテンツ</div>
      </MobileBottomSheet>
    );
    expect(document.body.style.touchAction).toBe('none');

    rerender(
      <MobileBottomSheet isOpen={false} onClose={vi.fn()}>
        <div>コンテンツ</div>
      </MobileBottomSheet>
    );
    expect(document.body.style.touchAction).not.toBe('none');
  });
});
