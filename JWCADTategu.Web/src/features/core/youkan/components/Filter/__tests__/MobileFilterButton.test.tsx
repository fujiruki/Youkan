import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { MobileFilterButton } from '../MobileFilterButton';

vi.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement> & { children?: React.ReactNode }) => (
      <div {...props}>{children}</div>
    ),
  },
}));

const mockSetFilterMode = vi.fn();

vi.mock('@/features/core/youkan/contexts/FilterContext', () => ({
  useFilter: () => ({
    filterMode: 'all',
    setFilterMode: mockSetFilterMode,
    hideCompleted: false,
    setHideCompleted: vi.fn(),
    toggleCompleted: vi.fn(),
  }),
}));

vi.mock('@/features/core/auth/providers/AuthProvider', () => ({
  useAuth: () => ({
    user: null,
    tenant: null,
    joinedTenants: [
      { id: 'tenant-1', name: '藤田建具店', title: '藤田建具店' },
    ],
    isAuthenticated: true,
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
    checkAuth: vi.fn(),
    switchTenant: vi.fn(),
  }),
}));

describe('MobileFilterButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.body.style.touchAction = '';
  });

  it('フィルターボタンが表示される', () => {
    render(<MobileFilterButton />);
    expect(screen.getByRole('button', { name: 'フィルター' })).toBeInTheDocument();
  });

  it('現在のフィルターラベルが表示される（all → すべて）', () => {
    render(<MobileFilterButton />);
    expect(screen.getByText('すべて')).toBeInTheDocument();
  });

  it('ボタンクリックでシートが展開される', () => {
    render(<MobileFilterButton />);
    fireEvent.click(screen.getByRole('button', { name: 'フィルター' }));
    expect(screen.getByText('フィルター', { selector: 'h2' })).toBeInTheDocument();
  });

  it('シート内に全ての選択肢が表示される', () => {
    render(<MobileFilterButton />);
    fireEvent.click(screen.getByRole('button', { name: 'フィルター' }));
    expect(screen.getByText('全て')).toBeInTheDocument();
    expect(screen.getByText('個人')).toBeInTheDocument();
    expect(screen.getByText('会社')).toBeInTheDocument();
    expect(screen.getByText('藤田建具店')).toBeInTheDocument();
  });

  it('現在の filterMode（all）の項目にチェックアイコンが付く', () => {
    render(<MobileFilterButton />);
    fireEvent.click(screen.getByRole('button', { name: 'フィルター' }));
    const allButton = screen.getByText('全て').closest('button');
    expect(allButton).toHaveClass('text-indigo-600', { exact: false });
  });

  it('選択肢クリックで setFilterMode が呼ばれシートが閉じる', () => {
    render(<MobileFilterButton />);
    fireEvent.click(screen.getByRole('button', { name: 'フィルター' }));
    fireEvent.click(screen.getByText('個人'));
    expect(mockSetFilterMode).toHaveBeenCalledWith('personal');
    expect(screen.queryByText('フィルター', { selector: 'h2' })).toBeNull();
  });
});
