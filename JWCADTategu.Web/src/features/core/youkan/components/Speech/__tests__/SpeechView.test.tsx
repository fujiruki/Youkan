import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { SpeechView } from '../SpeechView';

const mockSpeak = vi.fn();
const mockPause = vi.fn();
const mockResume = vi.fn();
const mockStop = vi.fn();

const defaultSpeechState = {
  isSpeaking: false,
  isPaused: false,
  isSupported: true,
  speak: mockSpeak,
  pause: mockPause,
  resume: mockResume,
  stop: mockStop,
};

vi.mock('@/features/core/youkan/hooks/useSpeechSynthesis', () => ({
  useSpeechSynthesis: vi.fn(() => defaultSpeechState),
}));

vi.mock('@/features/core/youkan/viewmodels/useYoukanViewModel', () => ({
  useYoukanViewModel: vi.fn(() => ({
    executionItem: {
      id: 'item-1',
      title: '実行中タスク',
      status: 'focus',
      projectId: 'proj-1',
      projectTitle: 'テストプロジェクト',
      focusOrder: 1,
      isEngaged: true,
      interrupt: false,
      weight: 1,
      statusUpdatedAt: 0,
    },
    todayCommits: [
      {
        id: 'item-2',
        title: '今日コミット',
        status: 'focus',
        projectId: 'proj-1',
        projectTitle: 'テストプロジェクト',
        focusOrder: 2,
        isEngaged: false,
        interrupt: false,
        weight: 1,
        statusUpdatedAt: 0,
      },
    ],
    todayCandidates: [],
    gdbActive: [
      {
        id: 'item-3',
        title: 'Inboxタスク',
        status: 'inbox',
        projectId: null,
        projectTitle: null,
        focusOrder: 0,
        isEngaged: false,
        interrupt: false,
        weight: 1,
        statusUpdatedAt: 0,
      },
    ],
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

describe('SpeechView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('isOpen=false のとき何も表示されない', () => {
    render(<SpeechView isOpen={false} onClose={vi.fn()} />);
    expect(screen.queryByText('タスク読み上げ')).toBeNull();
  });

  it('isOpen=true のとき立場ラベルとアイテム一覧が表示される', () => {
    render(<SpeechView isOpen={true} onClose={vi.fn()} />);
    expect(screen.getByText('個人')).toBeInTheDocument();
    expect(screen.getByText('実行中タスク')).toBeInTheDocument();
    expect(screen.getByText('今日コミット')).toBeInTheDocument();
    expect(screen.getByText('Inboxタスク')).toBeInTheDocument();
  });

  it('再生ボタンクリックで speak() が呼ばれる', () => {
    render(<SpeechView isOpen={true} onClose={vi.fn()} />);
    const playButton = screen.getByRole('button', { name: /再生/ });
    fireEvent.click(playButton);
    expect(mockSpeak).toHaveBeenCalledTimes(1);
  });

  it('一時停止クリックで pause() が呼ばれる', async () => {
    const { useSpeechSynthesis } = await import('@/features/core/youkan/hooks/useSpeechSynthesis');
    vi.mocked(useSpeechSynthesis).mockReturnValue({
      isSpeaking: true,
      isPaused: false,
      isSupported: true,
      speak: mockSpeak,
      pause: mockPause,
      resume: mockResume,
      stop: mockStop,
    });

    render(<SpeechView isOpen={true} onClose={vi.fn()} />);
    const pauseButton = screen.getByRole('button', { name: /一時停止/ });
    fireEvent.click(pauseButton);
    expect(mockPause).toHaveBeenCalledTimes(1);
  });

  it('次へクリックで speak() が呼ばれる', async () => {
    const { useSpeechSynthesis } = await import('@/features/core/youkan/hooks/useSpeechSynthesis');
    vi.mocked(useSpeechSynthesis).mockReturnValue({
      isSpeaking: false,
      isPaused: false,
      isSupported: true,
      speak: mockSpeak,
      pause: mockPause,
      resume: mockResume,
      stop: mockStop,
    });

    render(<SpeechView isOpen={true} onClose={vi.fn()} />);
    const nextButton = screen.getByRole('button', { name: /次へ/ });
    fireEvent.click(nextButton);
    expect(mockSpeak).toHaveBeenCalledTimes(1);
  });

  it('閉じるボタンで stop() と onClose が呼ばれる', () => {
    const onClose = vi.fn();
    render(<SpeechView isOpen={true} onClose={onClose} />);
    const closeButton = screen.getByRole('button', { name: /閉じる/ });
    fireEvent.click(closeButton);
    expect(mockStop).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
