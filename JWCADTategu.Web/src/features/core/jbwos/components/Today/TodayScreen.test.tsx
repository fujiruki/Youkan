import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TodayScreen } from './TodayScreen';
import { useJBWOSViewModel } from '../../viewmodels/useJBWOSViewModel';

// Mock the ViewModel
vi.mock('../../viewmodels/useJBWOSViewModel', () => ({
    useJBWOSViewModel: vi.fn(),
}));

describe('TodayScreen', () => {
    // Mock functions
    const mockCompleteItem = vi.fn();
    const mockCommitToToday = vi.fn();
    const mockReturnToInbox = vi.fn();
    const mockStartImmediately = vi.fn();

    // Mock Data
    const mockActiveItem = {
        id: 'item-1',
        title: 'Active Task',
        status: 'ready',
        is_boosted: false
    };

    const mockCandidateItem = {
        id: 'candidate-1',
        title: 'Candidate Task',
        status: 'ready',
        is_boosted: false
    };

    beforeEach(() => {
        vi.clearAllMocks();

        // Default Mock Implementation
        (useJBWOSViewModel as any).mockReturnValue({
            todayCandidates: [mockCandidateItem],
            todayCommits: [mockActiveItem],
            executionItem: mockActiveItem,
            completeItem: mockCompleteItem,
            commitToToday: mockCommitToToday,
            returnToInbox: mockReturnToInbox,
            startImmediately: mockStartImmediately,
            prioritizeTask: vi.fn(),
            uncommitFromToday: vi.fn(),
            updateItemTitle: vi.fn(),
            deleteItem: vi.fn(),
            updateItem: vi.fn(),
            clearError: vi.fn(),
            error: null,
        });
    });

    it('Complete button calls completeItem with correct ID', () => {
        render(<TodayScreen />);

        // Find "Complete" button (assuming text content "完了")
        const completeButton = screen.getByText('完了');

        // Click it
        fireEvent.click(completeButton);

        // Verify call
        expect(mockCompleteItem).toHaveBeenCalledTimes(1);
        expect(mockCompleteItem).toHaveBeenCalledWith('item-1');
    });

    it('Commit button (Candidate) calls commitToToday with correct ID', () => {
        // Setup: Ensure we can commit (limit not reached is checked in VM, but button visible condition is in View)
        // TodayScreen shows candidates if canCommitMore (commits < 2)
        // So we need to mock commits to be empty or less than 2
        (useJBWOSViewModel as any).mockReturnValue({
            todayCandidates: [mockCandidateItem],
            todayCommits: [], // Empty to allow adding
            executionItem: null,
            completeItem: mockCompleteItem,
            commitToToday: mockCommitToToday,
            returnToInbox: mockReturnToInbox,
            startImmediately: mockStartImmediately,
            prioritizeTask: vi.fn(),
            uncommitFromToday: vi.fn(),
            updateItemTitle: vi.fn(),
            deleteItem: vi.fn(),
            updateItem: vi.fn(),
            clearError: vi.fn(),
            error: null,
        });

        render(<TodayScreen />);

        // Find "これからやる" button
        // In the code it's "これからやる" inside the candidate map
        const commitButton = screen.getByText('これからやる');

        // Click it
        fireEvent.click(commitButton);

        // Verify call
        expect(mockCommitToToday).toHaveBeenCalledTimes(1);
        expect(mockCommitToToday).toHaveBeenCalledWith('candidate-1');
    });
});
