import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TodayScreen } from './TodayScreen';
import { useJBWOSViewModel } from '../../viewmodels/useJBWOSViewModel';
import React from 'react';

// Mock the ViewModel
vi.mock('../../viewmodels/useJBWOSViewModel', () => ({
    useJBWOSViewModel: vi.fn(),
}));

// Mock child components that are not focus of test to simplify
vi.mock('./LifeChecklist', () => ({ LifeChecklist: () => <div data-testid="life-checklist" /> }));
vi.mock('./GentleReliefModal', () => ({ GentleReliefModal: () => <div data-testid="gentle-relief-modal" /> }));
// Mock FutureBoard if necessary, but it's not rendered by default

// Mock framer-motion AnimatePresence to just render children
vi.mock('framer-motion', async (importOriginal) => {
    const actual = await importOriginal();
    return {
        // @ts-ignore
        ...actual,
        AnimatePresence: ({ children }: any) => <>{children}</>,
        motion: {
            div: ({ children, className, onClick }: any) => (
                <div className={className} onClick={onClick}>
                    {children}
                </div>
            ),
        }
    };
});

describe('TodayScreen Integration', () => {
    const mockDeleteItem = vi.fn();
    const mockReturnToInbox = vi.fn();

    // Default mock data
    const mockCandidateItem = {
        id: '1',
        title: 'Test Candidate',
        status: 'confirmed',
        createdAt: 0,
        updatedAt: 0,
        statusUpdatedAt: 0,
    };

    beforeEach(() => {
        vi.clearAllMocks();

        // Setup default mock implementation
        (useJBWOSViewModel as any).mockReturnValue({
            todayCandidates: [mockCandidateItem],
            todayCommits: [],
            executionItem: null,
            error: null,

            // Actions
            deleteItem: mockDeleteItem,
            returnToInbox: mockReturnToInbox,

            // Other required mocks to prevent crash
            refresh: vi.fn(),
            resolveDecision: vi.fn(),
            commitToToday: vi.fn(),
            completeItem: vi.fn(),
            updateItemTitle: vi.fn(),
            prioritizeTask: vi.fn(),
            uncommitFromToday: vi.fn(),
            updatePreparationDate: vi.fn(),
            updateItem: vi.fn(),
            updateCapacityConfig: vi.fn(),
            addSideMemo: vi.fn(),
            deleteSideMemo: vi.fn(),
            memoToInbox: vi.fn(),
            throwIn: vi.fn(),
            clearError: vi.fn(),
        });

        // Mock window.confirm
        window.confirm = vi.fn(() => true);
    });

    it('should call deleteItem when "Complete Delete" is clicked in DecisionDetailModal', async () => {
        render(<TodayScreen onBack={vi.fn()} />);

        // 1. Click candidate to open modal
        const candidate = screen.getByText('Test Candidate');
        fireEvent.click(candidate);

        // 2. Locate "Not Now" (今回見送り...) button and click it to open menu
        const notNowButton = screen.getByText('今回見送り...');
        fireEvent.click(notNowButton);

        // 3. Locate "Complete Delete" (完全削除) button and click it
        const deleteButton = screen.getByText('完全削除');
        fireEvent.click(deleteButton);

        // 4. Verify deleteItem was called (Current Bug: returnToInbox is called instead)
        expect(mockDeleteItem).toHaveBeenCalledWith('1');
        expect(mockReturnToInbox).not.toHaveBeenCalled();
    });
});
