import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { copyToClipboard, downloadText, downloadMarkdown } from '../clipboard';

describe('copyToClipboard', () => {
  beforeEach(() => {
    Object.defineProperty(navigator, 'clipboard', {
      writable: true,
      value: {
        writeText: vi.fn(),
      },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('成功時にtrueを返す', async () => {
    vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);
    const result = await copyToClipboard('テスト文字列');
    expect(result).toBe(true);
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('テスト文字列');
  });

  it('失敗時にfalseを返す', async () => {
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new Error('拒否'));
    const result = await copyToClipboard('テスト文字列');
    expect(result).toBe(false);
  });

  it('clipboard APIがない場合はfallbackしてtrueを返す', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      writable: true,
      value: undefined,
    });
    Object.defineProperty(document, 'execCommand', {
      writable: true,
      value: vi.fn().mockReturnValue(true),
    });
    const result = await copyToClipboard('フォールバック文字列');
    expect(result).toBe(true);
    expect(document.execCommand).toHaveBeenCalledWith('copy');
  });
});

describe('downloadText', () => {
  it('Blobを生成してダウンロードリンクをクリックする', () => {
    const clickSpy = vi.fn();
    const createElementSpy = vi.spyOn(document, 'createElement').mockReturnValue({
      href: '',
      download: '',
      click: clickSpy,
      style: {},
    } as any);
    const createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url');
    const revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const appendChildSpy = vi.spyOn(document.body, 'appendChild').mockImplementation((node) => node);
    const removeChildSpy = vi.spyOn(document.body, 'removeChild').mockImplementation((node) => node);

    downloadText('テスト内容', 'test.txt');

    expect(createObjectURLSpy).toHaveBeenCalledWith(expect.any(Blob));
    expect(clickSpy).toHaveBeenCalled();
    expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:mock-url');

    createElementSpy.mockRestore();
    createObjectURLSpy.mockRestore();
    revokeObjectURLSpy.mockRestore();
    appendChildSpy.mockRestore();
    removeChildSpy.mockRestore();
  });

  it('正しいファイル名でダウンロードを設定する', () => {
    const mockAnchor = { href: '', download: '', click: vi.fn(), style: {} } as any;
    vi.spyOn(document, 'createElement').mockReturnValue(mockAnchor);
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    vi.spyOn(document.body, 'appendChild').mockImplementation((node) => node);
    vi.spyOn(document.body, 'removeChild').mockImplementation((node) => node);

    downloadText('内容', 'output.txt');

    expect(mockAnchor.download).toBe('output.txt');
    vi.restoreAllMocks();
  });
});

describe('downloadMarkdown', () => {
  it('downloadTextを呼び出す薄いラッパーとして動作する', () => {
    const mockAnchor = { href: '', download: '', click: vi.fn(), style: {} } as any;
    const createElementSpy = vi.spyOn(document, 'createElement').mockReturnValue(mockAnchor);
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    vi.spyOn(document.body, 'appendChild').mockImplementation((node) => node);
    vi.spyOn(document.body, 'removeChild').mockImplementation((node) => node);

    downloadMarkdown('# マークダウン', 'report.md');

    expect(mockAnchor.download).toBe('report.md');
    expect(createElementSpy).toHaveBeenCalledWith('a');
    vi.restoreAllMocks();
  });
});
