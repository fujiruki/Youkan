import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FutureBoard } from './FutureBoard';
import * as useYoukanViewModelModule from '../youkan/viewmodels/useYoukanViewModel';
import { Item } from '../youkan/types';

// Mock dependencies
vi.mock('../youkan/viewmodels/useYoukanViewModel');
vi.mock('../youkan/logic/capacity', () => ({
    getDailyCapacity: vi.fn().mockReturnValue(480),
    isHoliday: vi.fn().mockReturnValue(false),
}));
// Mock DndContext to avoid issues in test environment if needed, 
// but for simple list rendering verification we might not need to mock dnd-kit fully 
// if we just check for presence of items.

describe('FutureBoard', () => {
    const mockViewModel = {
        gdbActive: [] as Item[],
        gdbPreparation: [] as Item[],
        gdbIntent: [] as Item[],
        gdbLog: [] as Item[],
        todayCandidates: [] as Item[],
        todayCommits: [] as Item[],
        executionItem: null,
        capacityConfig: {},
        updatePreparationDate: vi.fn(),
        resolveDecision: vi.fn(),
        deleteItem: vi.fn(),
        updateItem: vi.fn(),
        setExecutionItem: vi.fn(),
    };

    beforeEach(() => {
        vi.clearAllMocks();
        (useYoukanViewModelModule.useYoukanViewModel as any).mockReturnValue(mockViewModel);
    });

    const createMockItem = (overrides: Partial<Item>): Item => ({
        id: 'mock-item',
        title: 'Mock Item',
        status: 'inbox',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        statusUpdatedAt: Date.now(),
        interrupt: false,
        weight: 1,
        focusOrder: 0,
        isIntent: false,
        ...overrides
    });

    it('現行ラベル「未定・Inbox」セクションを表示する', () => {
        const inboxItem = createMockItem({ id: '1', title: 'Inbox Item', status: 'inbox', updatedAt: 100 });
        mockViewModel.gdbActive = [inboxItem];
        mockViewModel.gdbPreparation = [];

        render(<FutureBoard onClose={() => { }} />);

        // 現行 UI は単一の「未定・Inbox (N)」見出しになっている
        expect(screen.getByText(/未定・Inbox/)).toBeDefined();
    });

    it('inbox アイテムを Stock リストに描画する', () => {
        const draft = createMockItem({ id: '1', title: 'Unorganized Task', status: 'inbox' });
        mockViewModel.gdbActive = [draft];

        render(<FutureBoard onClose={() => { }} />);

        expect(screen.getByText(/未定・Inbox/)).toBeInTheDocument();
        expect(screen.getByText('Unorganized Task')).toBeInTheDocument();
    });

    it('includes unscheduled preparation items in Stock', () => {
        // Case: Item is in gdbPreparation (maybe moved there) but has prep_date removed (unscheduled)
        const unscheduledPrepItem = createMockItem({ id: '7', title: 'Unscheduled Prep', status: 'inbox', prep_date: null, updatedAt: 100 });

        mockViewModel.gdbActive = [];
        mockViewModel.gdbPreparation = [unscheduledPrepItem];

        render(<FutureBoard onClose={() => { }} />);

        expect(screen.getByText('Unscheduled Prep')).toBeDefined();
    });
});
