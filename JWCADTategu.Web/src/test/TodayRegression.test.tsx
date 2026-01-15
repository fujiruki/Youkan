import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TodayScreen } from '../features/jbwos/components/Today/TodayScreen';
import { TodayCandidateDetailModal } from '../features/jbwos/components/Modal/TodayCandidateDetailModal';
import { JBWOSRepository } from '../features/jbwos/repositories/JBWOSRepository';
import { createMockItem } from './testUtils'; // Fixed path to .tsx
// import userEvent from '@testing-library/user-event'; // Unused

// Mock Dependencies
vi.mock('../features/jbwos/components/Today/LifeChecklist', () => ({
    LifeChecklist: () => <div>Life Checklist</div>
}));
vi.mock('../features/jbwos/components/Today/GentleReliefModal', () => ({
    GentleReliefModal: () => null
}));

// Mock Repository
vi.mock('../features/jbwos/repositories/JBWOSRepository', () => ({
    JBWOSRepository: {
        getGdbShelf: vi.fn(),
        getTodayView: vi.fn(),
        getMemos: vi.fn().mockResolvedValue([]),
        completeItem: vi.fn().mockResolvedValue({}),
        startExecution: vi.fn().mockResolvedValue({}),
        pauseExecution: vi.fn().mockResolvedValue({}),
        updateItem: vi.fn().mockResolvedValue({}),
        createMemo: vi.fn(),
        deleteMemo: vi.fn(),
    }
}));

// Mock Contexts
vi.mock('../contexts/ToastContext', () => ({
    useToast: () => ({ showToast: vi.fn() })
}));
vi.mock('../features/jbwos/contexts/UndoContext', () => ({
    useUndo: () => ({ addUndoAction: vi.fn() })
}));

// Mock Global Settings (localStorage)
const mockSettings = { hoursPerDay: 7 };
Object.defineProperty(window, 'localStorage', {
    value: {
        getItem: vi.fn((key) => key === 'globalEstimationSettings' ? JSON.stringify(mockSettings) : null),
        setItem: vi.fn(),
    },
    writable: true
});

describe('Today Screen Regression & New Features', () => {

    beforeEach(() => {
        vi.clearAllMocks();
        // Default Mock Return
        (JBWOSRepository.getGdbShelf as any).mockResolvedValue({ active: [], preparation: [], intent: [], log: [] });
        (JBWOSRepository.getTodayView as any).mockResolvedValue({ candidates: [], commits: [] });
    });

    it('EstimtedTimeInput: 1日ボタンを押すと7時間(420分)が設定される', async () => {
        const item = createMockItem({ id: '1', title: 'Test Task' });
        const onConfirm = vi.fn();
        const onUpdate = vi.fn();
        const onClose = vi.fn();

        render(
            <TodayCandidateDetailModal
                item={item}
                onClose={onClose}
                onConfirm={onConfirm}
                onUpdate={onUpdate}
            />
        );

        // Click "1日" button
        // The button has text "1" and subtext "日"
        const day1Btn = screen.getByText('1', { selector: 'span' }).closest('button');
        fireEvent.click(day1Btn!);

        // Verify onUpdate called with 420 mins (7 hours)
        expect(onUpdate).toHaveBeenCalledWith('1', expect.objectContaining({ estimatedMinutes: 420 }));

        // Display check
        expect(screen.getByText('1日 (7h)')).toBeInTheDocument();
    });

    it('Commit Action: 確定ボタンでonConfirmが呼ばれ、推定時間も保存される', async () => {
        const item = createMockItem({ id: 'c-1', title: 'Candidate Task', estimatedMinutes: 60 });
        const onConfirm = vi.fn();
        const onUpdate = vi.fn();

        render(
            <TodayCandidateDetailModal
                item={item}
                onClose={vi.fn()}
                onConfirm={onConfirm}
                onUpdate={onUpdate}
            />
        );

        // Click "1h" button to change it
        fireEvent.click(screen.getByText('2h')); // Change to 120min

        // Click Confirm
        fireEvent.click(screen.getByText('今日やることを確定'));

        // Expect update then confirm
        expect(onUpdate).toHaveBeenCalledWith('c-1', expect.objectContaining({ estimatedMinutes: 120 }));
        expect(onConfirm).toHaveBeenCalledWith('c-1');
    });

    // Note: Integration test of Today Screen Logic requires wrapping TodayScreen with Recoil or similar if state was global, 
    // but here it is ViewModel driven. We can test the View + ViewModel integration if we mock the Repo correctly.

    // Testing "Today Complete -> Advance" again in this suite for regression safety
    it.skip('Regression: 完了ボタンで次のタスクがActiveになる (ViewModel Integration)', async () => {
        const item1 = createMockItem({ id: 'ex-1', title: 'Current Task', status: 'today_commit' });
        const item2 = createMockItem({ id: 'next-1', title: 'Next Task', status: 'today_commit' });

        (JBWOSRepository.getTodayView as any).mockResolvedValue({
            commits: [item1, item2],
            candidates: [],
            execution: item1
        });

        render(<TodayScreen onBack={vi.fn()} />);

        // Wait for load
        await waitFor(() => expect(screen.getByText('Current Task')).toBeInTheDocument());

        // Click Complete on item1
        const completeBtns = screen.getAllByText('完了');
        fireEvent.click(completeBtns[0]); // Current is usually first or prominent

        // Verify item1 removed, item2 visible
        await waitFor(() => {
            expect(screen.queryByText('Current Task')).not.toBeInTheDocument();
        });
        expect(screen.getByText('Next Task')).toBeInTheDocument(); // Should be Active now

        // Verify Next Task is treated as Execution (Check for "今日はやめる" arrow which appears on Active)
        // Or check that it is NOT in the waiting list
        // const rows = screen.getAllByRole('article'); // Comment out or remove unused
        // Let's rely on text presence and absence of "Current Task"
    });
});
