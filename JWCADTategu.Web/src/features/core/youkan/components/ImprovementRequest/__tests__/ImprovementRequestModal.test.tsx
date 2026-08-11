import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ImprovementRequestModal } from '../ImprovementRequestModal';

vi.mock('@/api/client', () => ({
  ApiClient: {
    submitImprovementRequest: vi.fn(),
  },
}));

vi.mock('@/contexts/ToastContext', () => ({
  useToast: vi.fn(() => ({
    showToast: vi.fn(),
    toasts: [],
    dismissToast: vi.fn(),
  })),
}));

function makeImageFile(name = 'screenshot.png', type = 'image/png', sizeBytes = 1024): File {
  const content = new Uint8Array(sizeBytes);
  return new File([content], name, { type });
}

describe('ImprovementRequestModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('isOpen=false のとき何も表示されない', () => {
    render(<ImprovementRequestModal isOpen={false} onClose={vi.fn()} />);
    expect(screen.queryByText('改善要望を送る')).toBeNull();
  });

  it('isOpen=true のとき本文入力欄と送信ボタンが表示される', () => {
    render(<ImprovementRequestModal isOpen={true} onClose={vi.fn()} />);
    expect(screen.getByLabelText('本文')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '送信する' })).toBeInTheDocument();
  });

  it('本文が空のとき送信ボタンは無効化される', () => {
    render(<ImprovementRequestModal isOpen={true} onClose={vi.fn()} />);
    expect(screen.getByRole('button', { name: '送信する' })).toBeDisabled();
  });

  it('空白のみの本文でも送信ボタンは無効化される', () => {
    render(<ImprovementRequestModal isOpen={true} onClose={vi.fn()} />);
    const textarea = screen.getByLabelText('本文');
    fireEvent.change(textarea, { target: { value: '   ' } });
    expect(screen.getByRole('button', { name: '送信する' })).toBeDisabled();
  });

  it('本文を入力すると送信ボタンが有効化される', () => {
    render(<ImprovementRequestModal isOpen={true} onClose={vi.fn()} />);
    const textarea = screen.getByLabelText('本文');
    fireEvent.change(textarea, { target: { value: 'カレンダーが使いづらい' } });
    expect(screen.getByRole('button', { name: '送信する' })).not.toBeDisabled();
  });

  it('本文を5回変更しても背後の重い画面を再レンダリングしない', () => {
    let backgroundRenderCount = 0;
    const HeavyBackground = () => {
      backgroundRenderCount++;
      return <div data-testid="heavy-background" />;
    };

    render(
      <>
        <HeavyBackground />
        <ImprovementRequestModal isOpen={true} onClose={vi.fn()} />
      </>
    );
    const countAfterMount = backgroundRenderCount;
    const textarea = screen.getByLabelText('本文');

    for (const value of ['a', 'ab', 'abc', 'abcd', 'abcde']) {
      fireEvent.change(textarea, { target: { value } });
    }

    expect(backgroundRenderCount).toBe(countAfterMount);
  });

  it('送信成功でAPIが呼ばれ、トースト表示とモーダルクローズが行われる', async () => {
    const { ApiClient } = await import('@/api/client');
    const { useToast } = await import('@/contexts/ToastContext');
    const mockSubmit = vi.mocked(ApiClient.submitImprovementRequest);
    mockSubmit.mockResolvedValue({ success: true });
    const showToast = vi.fn();
    vi.mocked(useToast).mockReturnValue({ showToast, toasts: [], dismissToast: vi.fn() });

    const onClose = vi.fn();
    render(<ImprovementRequestModal isOpen={true} onClose={onClose} />);
    fireEvent.change(screen.getByLabelText('本文'), { target: { value: 'テスト本文です' } });
    fireEvent.click(screen.getByRole('button', { name: '送信する' }));

    await waitFor(() => {
      expect(mockSubmit).toHaveBeenCalledWith('テスト本文です', undefined);
    });
    await waitFor(() => {
      expect(showToast).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });
  });

  it('画像を選択すると次の送信でAPIにFileが渡される', async () => {
    const { ApiClient } = await import('@/api/client');
    const mockSubmit = vi.mocked(ApiClient.submitImprovementRequest);
    mockSubmit.mockResolvedValue({ success: true });

    render(<ImprovementRequestModal isOpen={true} onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('本文'), { target: { value: '画像付きテスト' } });

    const file = makeImageFile();
    const fileInput = screen.getByLabelText('画像添付') as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [file] } });

    fireEvent.click(screen.getByRole('button', { name: '送信する' }));

    await waitFor(() => {
      expect(mockSubmit).toHaveBeenCalledWith('画像付きテスト', file);
    });
  });

  it('5MBを超える画像を選択するとエラーメッセージが表示され、ファイルは保持されない', async () => {
    const { ApiClient } = await import('@/api/client');
    const mockSubmit = vi.mocked(ApiClient.submitImprovementRequest);
    mockSubmit.mockResolvedValue({ success: true });

    render(<ImprovementRequestModal isOpen={true} onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('本文'), { target: { value: 'サイズ超過テスト' } });

    const bigFile = makeImageFile('huge.png', 'image/png', 6 * 1024 * 1024);
    const fileInput = screen.getByLabelText('画像添付') as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [bigFile] } });

    expect(screen.getByRole('alert')).toHaveTextContent(/5MB/);

    fireEvent.click(screen.getByRole('button', { name: '送信する' }));
    await waitFor(() => {
      expect(mockSubmit).toHaveBeenCalledWith('サイズ超過テスト', undefined);
    });
  });

  it('対応していない画像形式を選択するとエラーメッセージが表示される', () => {
    render(<ImprovementRequestModal isOpen={true} onClose={vi.fn()} />);
    const file = makeImageFile('doc.gif', 'image/gif', 1024);
    const fileInput = screen.getByLabelText('画像添付') as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [file] } });

    expect(screen.getByRole('alert')).toHaveTextContent(/対応していない/);
  });

  it('クリップボード貼り付け(onPaste)で画像を添付できる', async () => {
    const { ApiClient } = await import('@/api/client');
    const mockSubmit = vi.mocked(ApiClient.submitImprovementRequest);
    mockSubmit.mockResolvedValue({ success: true });

    render(<ImprovementRequestModal isOpen={true} onClose={vi.fn()} />);
    const textarea = screen.getByLabelText('本文');
    fireEvent.change(textarea, { target: { value: '貼り付けテスト' } });

    const pastedFile = makeImageFile('pasted.png', 'image/png', 2048);
    const clipboardData = {
      items: [
        {
          kind: 'file',
          type: 'image/png',
          getAsFile: () => pastedFile,
        },
      ],
    };
    fireEvent.paste(textarea, { clipboardData });

    fireEvent.click(screen.getByRole('button', { name: '送信する' }));

    await waitFor(() => {
      expect(mockSubmit).toHaveBeenCalledWith('貼り付けテスト', pastedFile);
    });
  });

  it('送信失敗時はエラーメッセージを表示し、入力内容を保持する(再送可能)', async () => {
    const { ApiClient } = await import('@/api/client');
    const mockSubmit = vi.mocked(ApiClient.submitImprovementRequest);
    mockSubmit.mockRejectedValue(new Error('サーバーエラー'));

    const onClose = vi.fn();
    render(<ImprovementRequestModal isOpen={true} onClose={onClose} />);
    fireEvent.change(screen.getByLabelText('本文'), { target: { value: '失敗するテスト' } });
    fireEvent.click(screen.getByRole('button', { name: '送信する' }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('サーバーエラー');
    });
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByLabelText('本文')).toHaveValue('失敗するテスト');

    // 再送可能: ボタンは再度有効
    expect(screen.getByRole('button', { name: '送信する' })).not.toBeDisabled();
  });
});
