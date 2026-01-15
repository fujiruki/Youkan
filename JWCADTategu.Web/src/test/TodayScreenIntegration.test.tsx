import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TodayScreen } from '../features/core/jbwos/components/Today/TodayScreen';
import { createMockItem } from './testUtils';
import * as ViewModelHook from '../features/core/jbwos/viewmodels/useJBWOSViewModel';

// ApiClientのモック
vi.mock('../api/client', () => ({
    ApiClient: {
        updateItem: vi.fn(),
        pauseExecution: vi.fn(),
        startExecution: vi.fn(),
    }
}));

describe('Today Screen Integration', () => {
    // Mock Data
    const mockCandidate = createMockItem({
        id: 'candidate-1',
        title: '候補タスク',
        status: 'ready',
        due_date: '2026-01-20',
        work_days: 1,
        memo: '候補のメモ',
    });

    const mockCommitItem = createMockItem({
        id: 'commit-1',
        title: '実行中タスク',
        status: 'today_commit',
    });

    // Spies
    const mockCommitToToday = vi.fn();
    const mockCompleteItem = vi.fn();
    const mockReturnToInbox = vi.fn();
    const mockUpdateItemTitle = vi.fn();
    const mockOnBack = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('候補タスクが表示され、確定(Commit)できる', () => {
        // Setup ViewModel
        vi.spyOn(ViewModelHook, 'useJBWOSViewModel').mockReturnValue({
            todayCandidates: [mockCandidate],
            todayCommits: [], // No active item yet
            commitToToday: mockCommitToToday,
            completeItem: mockCompleteItem,
            returnToInbox: mockReturnToInbox,
            updateItemTitle: mockUpdateItemTitle,
            error: null,
            clearError: vi.fn(),
        } as any);

        render(<TodayScreen onBack={mockOnBack} />);

        // Verify Candidate Rendering
        expect(screen.getByText('候補タスク')).toBeTruthy();
        expect(screen.getByText('候補 (GDBより)')).toBeTruthy();

        // Click "確定" button
        const commitButton = screen.getByText('今日やることを確定');
        fireEvent.click(commitButton);

        // Verify Action
        expect(mockCommitToToday).toHaveBeenCalledWith('candidate-1');
    });

    it.skip('実行中タスクが表示され、完了・中断・Inbox戻しができる', () => {
        // Setup ViewModel with Active Item
        vi.spyOn(ViewModelHook, 'useJBWOSViewModel').mockReturnValue({
            todayCandidates: [],
            todayCommits: [mockCommitItem], // This becomes activeItem
            commitToToday: mockCommitToToday,
            completeItem: mockCompleteItem,
            returnToInbox: mockReturnToInbox,
            updateItemTitle: mockUpdateItemTitle,
            error: null,
            clearError: vi.fn(),
        } as any);

        render(<TodayScreen onBack={mockOnBack} />);

        // Verify Active Item Rendering
        expect(screen.getByText('実行中タスク')).toBeTruthy();

        // Check for interactive elements to verify section presence
        const returnButton = screen.getByTitle('今はやめる (再判断)');
        expect(returnButton).toBeTruthy();

        // 1. Inbox Return
        fireEvent.click(returnButton);
        expect(mockReturnToInbox).toHaveBeenCalledWith('commit-1', 'today_commit');

        // 2. Complete
        const completeButton = screen.getByText('完了');
        fireEvent.click(completeButton);
        expect(mockCompleteItem).toHaveBeenCalledWith('commit-1');

        // 3. Pause
        expect(screen.getByText('ちょっと中断')).toBeTruthy();
    });

    it('候補の詳細モーダルを開き、編集できる', () => {
        vi.spyOn(ViewModelHook, 'useJBWOSViewModel').mockReturnValue({
            todayCandidates: [mockCandidate],
            todayCommits: [],
            commitToToday: mockCommitToToday,
            completeItem: mockCompleteItem,
            returnToInbox: mockReturnToInbox,
            updateItemTitle: mockUpdateItemTitle,
            error: null,
            clearError: vi.fn(),
        } as any);

        render(<TodayScreen onBack={mockOnBack} />);

        const card = screen.getByText('候補タスク');
        fireEvent.click(card);

        // Verify Modal Opens
        expect(screen.getByText('MEMO / 備考')).toBeTruthy();
        expect(screen.getByDisplayValue('候補のメモ')).toBeTruthy();

        // Edit Memo
        const memoArea = screen.getByDisplayValue('候補のメモ');
        fireEvent.change(memoArea, { target: { value: 'メモ編集しました' } });
        expect(screen.getByDisplayValue('メモ編集しました')).toBeTruthy();

        fireEvent.blur(memoArea);

        // Confirm
        const confirmBtn = screen.getAllByText('今日やることを確定')[1];
        fireEvent.click(confirmBtn);

        expect(mockCommitToToday).toHaveBeenCalledWith('candidate-1');
    });
});
