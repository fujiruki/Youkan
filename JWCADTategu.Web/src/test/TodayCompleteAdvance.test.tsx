import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TodayScreen } from '../features/core/jbwos/components/Today/TodayScreen';
import { JBWOSRepository } from '../features/core/jbwos/repositories/JBWOSRepository';
import { createMockItem } from './testUtils';

// Mock Dependencies to minimal
vi.mock('../features/jbwos/components/Today/LifeChecklist', () => ({
    LifeChecklist: () => <div>Life Checklist</div>
}));
vi.mock('../features/jbwos/components/Today/GentleReliefModal', () => ({
    GentleReliefModal: () => null
}));
vi.mock('../features/jbwos/components/Modal/TodayCandidateDetailModal', () => ({
    TodayCandidateDetailModal: () => null
}));

// Mock Repository
vi.mock('../features/core/jbwos/repositories/JBWOSRepository', () => ({
    JBWOSRepository: {
        getGdbShelf: vi.fn().mockResolvedValue({ active: [], preparation: [], intent: [], log: [] }),
        getTodayView: vi.fn().mockReturnValue({ candidates: [], commits: [] }), // Default empty, overwritten in test
        getMemos: vi.fn().mockResolvedValue([]),
        completeItem: vi.fn().mockResolvedValue({}),
        startExecution: vi.fn().mockResolvedValue({}),
        pauseExecution: vi.fn().mockResolvedValue({}),
        updateItem: vi.fn().mockResolvedValue({}),
    }
}));

// Mock Contexts
vi.mock('../contexts/ToastContext', () => ({
    useToast: () => ({ showToast: vi.fn() })
}));
vi.mock('../features/core/jbwos/contexts/UndoContext', () => ({
    useUndo: () => ({ addUndoAction: vi.fn() })
}));

describe('Today Task Completion & Advance (Real VM)', () => {

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it.skip('完了ボタンを押すと、Optimistic Updateにより即座に次のタスクがActiveになる', async () => {
        const item1 = createMockItem({ id: 't-1', title: 'Task 1', status: 'ready' });
        const item2 = createMockItem({ id: 't-2', title: 'Task 2', status: 'ready' });

        // Setup Repository Mock to return initial state
        (JBWOSRepository.getTodayView as any).mockResolvedValue({
            commits: [item1, item2],
            candidates: [],
            execution: item1
        });

        render(<TodayScreen onBack={vi.fn()} />);

        // Wait for initial load
        await waitFor(() => {
            expect(screen.getByText('Task 1')).toBeInTheDocument();
        });
        expect(screen.getByText('Task 2')).toBeInTheDocument();

        // Verify Task 1 is Active (Big Title or "現在のタスク")
        // The active item render has "現在のタスク" badge
        const badges = screen.getAllByText('現在のタスク');
        expect(badges.length).toBeGreaterThan(0);

        // Execute Complete
        // Find Complete button for Task 1. 
        // Active item has a "完了" button.
        const completeBtn = screen.getByText('完了').closest('button');
        fireEvent.click(completeBtn!);

        // Expectation:
        // 1. completeItem calls Repo
        expect(JBWOSRepository.completeItem).toHaveBeenCalledWith('t-1');

        // 2. UI Updates Optimistically: Task 1 gone, Task 2 becomes Active
        await waitFor(() => {
            expect(screen.queryByText('Task 1')).not.toBeInTheDocument();
            expect(screen.getByText('Task 2')).toBeInTheDocument();
        });

        // 3. Verify Task 2 is now displaying as Active
        // It should be the MAIN item.
        // We can check if "Task 2" is in the main title position
        // Or if the list of "Today's Judgment History" (Wait list) is empty?

        // If Task 2 is active, it is NOT in the wait (light) list.
        // Wait list items have "先にやる" arrow buttons.
        // Active item has "今日はやめる" arrow button.
        expect(screen.queryByTitle('先にやる')).not.toBeInTheDocument();
    });
});
