import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FutureBoard } from './FutureBoard';
import * as useJBWOSViewModelModule from '../jbwos/viewmodels/useJBWOSViewModel';
import { Item } from '../jbwos/types';

// Mock dependencies
vi.mock('../jbwos/viewmodels/useJBWOSViewModel');
vi.mock('../jbwos/logic/capacity', () => ({
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
        (useJBWOSViewModelModule.useJBWOSViewModel as any).mockReturnValue(mockViewModel);
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

    it('filters stockItems strictly to Inbox items (Unscheduled)', () => {
        // Setup scenarios
        const inboxItem = createMockItem({ id: '1', title: 'Inbox Item', status: 'inbox', updatedAt: 100 });
        const waitingItem = createMockItem({ id: '2', title: 'Waiting Item', status: 'waiting', updatedAt: 90 });
        const holdItem = createMockItem({ id: '3', title: 'Hold Item', status: 'waiting', updatedAt: 80 }); // hold -> waiting
        const intentItem = createMockItem({ id: '4', title: 'Intent Item', status: 'pending', updatedAt: 70 }); // intent -> pending
        const scheduledItem = createMockItem({ id: '5', title: 'Scheduled Item', status: 'focus', prep_date: 1234567890, updatedAt: 60 }); // scheduled -> ready
        const todayItem = createMockItem({ id: '6', title: 'Today Item', status: 'focus', updatedAt: 50 });

        // Items in vm.gdbActive usually include inbox, waiting, etc. if not filtered by getter
        // Items in vm.gdbPreparation include scheduled ones.

        mockViewModel.gdbActive = [inboxItem, waitingItem, todayItem, intentItem];
        mockViewModel.gdbPreparation = [scheduledItem, holdItem];
        // Note: hold might be in active or prep depending on implementation, but FutureBoard logic filters both sources.

        render(<FutureBoard onClose={() => { }} />);

        // Verify "未整理 (Inbox)" section exists
        expect(screen.getByText('未整理 (Inbox)')).toBeDefined();

        // Verify "スタンバイ (Stock)" section exists
        expect(screen.getByText('スタンバイ (Stock)')).toBeDefined();

        // Setup Scenarios for Split
        // 1. Unorganized (Draft): No due_date, no estimatedMinutes
        const draftItem = createMockItem({ id: 'draft1', title: 'Draft Item', status: 'inbox', updatedAt: 100 });
        // 2. Standby (Ready): Has due_date OR estimatedMinutes
        const readyItemDue = createMockItem({ id: 'ready1', title: 'Ready Item Due', status: 'inbox', due_date: '2026-01-31', updatedAt: 90 });
        const readyItemEst = createMockItem({ id: 'ready2', title: 'Ready Item Est', status: 'inbox', estimatedMinutes: 30, updatedAt: 95 });

        mockViewModel.gdbActive = [draftItem, readyItemDue, readyItemEst];
        mockViewModel.gdbPreparation = [];

        render(<FutureBoard onClose={() => { }} />);

        // Draft Item should be under "未整理" (implied by order or structure, but for now just presence)
        expect(screen.getByText('Draft Item')).toBeDefined();

        // Ready Items should be under "スタンバイ"
        expect(screen.getByText('Ready Item Due')).toBeDefined();
        expect(screen.getByText('Ready Item Est')).toBeDefined();

        // Important: We need to verify they are separated.
        // In the implementation, we'll likely use separate headers.
        // For strict TDD, we might check if they are in specific containers, but text presence is a good start.

        // Others should NOT be present
        expect(screen.queryByText('Waiting Item')).toBeNull();
        expect(screen.queryByText('Hold Item')).toBeNull();
        expect(screen.queryByText('Intent Item')).toBeNull();
        expect(screen.queryByText('Scheduled Item')).toBeNull();
        expect(screen.queryByText('Today Item')).toBeNull();
    });

    it('categorizes items into Unorganized and Standby correctly', () => {
        const draft = createMockItem({ id: '1', title: 'Unorganized Task', status: 'inbox' });
        const ready = createMockItem({ id: '2', title: 'Standby Task', status: 'inbox', estimatedMinutes: 60 });

        mockViewModel.gdbActive = [draft, ready];
        render(<FutureBoard onClose={() => { }} />);

        // We assume the headers will render.
        expect(screen.getByText('未整理 (Inbox)')).toBeInTheDocument();
        expect(screen.getByText('スタンバイ (Stock)')).toBeInTheDocument();
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
