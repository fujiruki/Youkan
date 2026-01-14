import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { JbwosBoard } from '../features/jbwos/components/GlobalBoard/GlobalBoard';
import { createMockItem } from './testUtils';
import * as ViewModelHook from '../features/jbwos/viewmodels/useJBWOSViewModel';

// ToastContextのモック
vi.mock('../contexts/ToastContext', () => ({
    useToast: () => ({
        showToast: vi.fn(),
    }),
}));

// ApiClientのモック
vi.mock('../api/client', () => ({
    ApiClient: {
        updateItem: vi.fn(),
        deleteItem: vi.fn(),
    }
}));

describe('Intent Item Delete Integration', () => {
    const mockIntentItem = createMockItem({
        id: 'test-intent-item',
        title: 'Intentテスト建具',
        status: 'inbox', // status doesn't matter much as long as it renders
    });

    const mockDeleteItem = vi.fn();
    const mockResolveDecision = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('Intentカラムのアイテムを右クリック→Deleteキーで削除できる', async () => {
        // ViewModelの挙動をスパイ
        vi.spyOn(ViewModelHook, 'useJBWOSViewModel').mockReturnValue({
            // items for columns
            gdbActive: [],
            gdbPreparation: [],
            gdbIntent: [mockIntentItem], // Correctly placed in Intent column
            gdbLog: [],

            // Actions
            resolveDecision: mockResolveDecision,
            updatePreparationDate: vi.fn(),
            deleteItem: mockDeleteItem,

            // Loading states
            isLoading: false,
            error: null,
            refresh: vi.fn(),

            // Other properties used by GlobalBoard
            todayCommits: [],
            todayCandidates: [],
            memos: [],
            addSideMemo: vi.fn(),
            deleteSideMemo: vi.fn(),
            memoToInbox: vi.fn(),
            throwIn: vi.fn(),
            clearError: vi.fn(),
        } as any);

        render(
            <BrowserRouter>
                <JbwosBoard />
            </BrowserRouter>
        );

        // Find item in Intent column
        const itemElement = screen.getByText('Intentテスト建具');
        expect(itemElement).toBeTruthy();

        // Right Click (Context Menu)
        fireEvent.contextMenu(itemElement);

        // Check Context Menu
        const deleteOption = screen.getByText(/削除/);
        expect(deleteOption).toBeTruthy();

        // Press Delete Key
        fireEvent.keyDown(document, { key: 'Delete' });

        // Verify deleteItem call
        expect(mockDeleteItem).toHaveBeenCalledWith('test-intent-item');
    });
});
