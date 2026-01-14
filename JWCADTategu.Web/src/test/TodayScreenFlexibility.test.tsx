import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TodayScreen } from '../features/jbwos/components/Today/TodayScreen';
import { createMockItem } from './testUtils';
import * as ViewModelHook from '../features/jbwos/viewmodels/useJBWOSViewModel';

vi.mock('../api/client', () => ({
    ApiClient: {
        startExecution: vi.fn(),
        updateItem: vi.fn(),
        pauseExecution: vi.fn(),
        commitToToday: vi.fn(),
        completeItem: vi.fn(),
    }
}));

describe('Today Screen Flexibility', () => {
    const mockActiveItem = createMockItem({
        id: 'commit-1',
        title: 'Active Task',
        status: 'today_commit',
    });

    const mockWaitingItem = createMockItem({
        id: 'commit-2',
        title: 'Waiting Task',
        status: 'today_commit',
    });

    const mockUncommitFromToday = vi.fn();
    const mockPrioritizeTask = vi.fn();
    const mockOnBack = vi.fn();

    const defaultViewModel = {
        todayCandidates: [],
        todayCommits: [mockActiveItem, mockWaitingItem],
        executionItem: mockActiveItem, // Active
        commitToToday: vi.fn(),
        completeItem: vi.fn(),
        returnToInbox: vi.fn(),
        updateItemTitle: vi.fn(),
        error: null,
        clearError: vi.fn(),
        uncommitFromToday: mockUncommitFromToday,
        prioritizeTask: mockPrioritizeTask,
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('Waitタスクに「先にやる」ボタンが表示され、クリックでprioritizeTaskが呼ばれる', () => {
        vi.spyOn(ViewModelHook, 'useJBWOSViewModel').mockReturnValue({
            ...defaultViewModel,
        } as any);

        render(<TodayScreen onBack={mockOnBack} />);

        const waitingTask = screen.getByText('Waiting Task').closest('div');
        expect(waitingTask).toBeTruthy();

        const prioritizeButton = screen.getByTitle('先にやる');
        fireEvent.click(prioritizeButton);

        expect(mockPrioritizeTask).toHaveBeenCalledWith('commit-2');
    });

    it('Activeタスクに「候補に戻す」ボタンが表示され、クリックでuncommitFromTodayが呼ばれる', () => {
        vi.spyOn(ViewModelHook, 'useJBWOSViewModel').mockReturnValue({
            ...defaultViewModel,
        } as any);

        render(<TodayScreen onBack={mockOnBack} />);

        // Active Task has "候補に戻す" (uncommit)
        // Since waiting items also have this button, we might find multiple.
        const uncommitBtns = screen.getAllByTitle('候補に戻す');
        const activeUncommitBtn = uncommitBtns[0]; // Active is at top

        fireEvent.click(activeUncommitBtn);

        expect(mockUncommitFromToday).toHaveBeenCalledWith('commit-1');
    });
});
