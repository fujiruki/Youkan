import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ForAiModal } from '../ForAiModal';

vi.mock('@/features/core/youkan/viewmodels/useYoukanViewModel', () => ({
  useYoukanViewModel: vi.fn(() => ({
    executionItem: null,
    todayCommits: [],
    todayCandidates: [],
    gdbActive: [],
    gdbPreparation: [],
    gdbIntent: [],
  })),
}));

vi.mock('@/features/core/youkan/contexts/FilterContext', () => ({
  useFilter: vi.fn(() => ({
    filterMode: 'personal',
    setFilterMode: vi.fn(),
    hideCompleted: false,
    setHideCompleted: vi.fn(),
    toggleCompleted: vi.fn(),
  })),
}));

vi.mock('@/features/core/auth/providers/AuthProvider', () => ({
  useAuth: vi.fn(() => ({
    isAuthenticated: true,
    user: { id: 'test-user', name: 'Test User' },
    tenant: null,
    joinedTenants: [],
    login: vi.fn(),
    logout: vi.fn(),
  })),
}));

vi.mock('@/lib/clipboard', () => ({
  copyToClipboard: vi.fn(),
  downloadMarkdown: vi.fn(),
}));

vi.mock('@/contexts/ToastContext', () => ({
  useToast: vi.fn(() => ({
    showToast: vi.fn(),
    toasts: [],
    dismissToast: vi.fn(),
  })),
}));

describe('ForAiModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('isOpen=false のとき何も表示されない', () => {
    render(<ForAiModal isOpen={false} onClose={vi.fn()} />);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByText('AIに状況を渡す')).toBeNull();
  });

  it('isOpen=true のとき立場ラベルと markdown が表示される', () => {
    render(<ForAiModal isOpen={true} onClose={vi.fn()} />);
    expect(screen.getByText(/AIに状況を渡す/)).toBeInTheDocument();
    expect(screen.getAllByText(/個人/).length).toBeGreaterThan(0);
    const textarea = screen.getByRole('textbox');
    expect(textarea).toBeInTheDocument();
    expect(textarea).toHaveAttribute('readOnly');
  });

  it('コピーボタンクリックで copyToClipboard が呼ばれる', async () => {
    const { copyToClipboard } = await import('@/lib/clipboard');
    const mockCopy = vi.mocked(copyToClipboard);
    mockCopy.mockResolvedValue(true);

    render(<ForAiModal isOpen={true} onClose={vi.fn()} />);
    const copyButton = screen.getByRole('button', { name: /クリップボード/ });
    fireEvent.click(copyButton);

    await waitFor(() => {
      expect(mockCopy).toHaveBeenCalledTimes(1);
    });
  });

  it('ダウンロードボタンクリックで downloadMarkdown が呼ばれる', async () => {
    const { downloadMarkdown } = await import('@/lib/clipboard');
    const mockDownload = vi.mocked(downloadMarkdown);

    render(<ForAiModal isOpen={true} onClose={vi.fn()} />);
    const downloadButton = screen.getByRole('button', { name: /ダウンロード/ });
    fireEvent.click(downloadButton);

    await waitFor(() => {
      expect(mockDownload).toHaveBeenCalledTimes(1);
    });
  });
});
