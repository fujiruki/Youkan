import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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

    it('filters stockItems strictly to Inbox items (Unscheduled)', () => {
        // Setup scenarios
        const inboxItem: Item = { id: '1', title: 'Inbox Item', status: 'inbox', updatedAt: 100 };
        const waitingItem: Item = { id: '2', title: 'Waiting Item', status: 'waiting', updatedAt: 90 };
        const holdItem: Item = { id: '3', title: 'Hold Item', status: 'decision_hold', updatedAt: 80 };
        const intentItem: Item = { id: '4', title: 'Intent Item', status: 'intent', updatedAt: 70 };
        const scheduledItem: Item = { id: '5', title: 'Scheduled Item', status: 'scheduled', prep_date: 1234567890, updatedAt: 60 };
        const todayItem: Item = { id: '6', title: 'Today Item', status: 'today_commit', updatedAt: 50 };

        // Items in vm.gdbActive usually include inbox, waiting, etc. if not filtered by getter
        // Items in vm.gdbPreparation include scheduled ones.

        mockViewModel.gdbActive = [inboxItem, waitingItem, todayItem, intentItem];
        mockViewModel.gdbPreparation = [scheduledItem, holdItem];
        // Note: hold might be in active or prep depending on implementation, but FutureBoard logic filters both sources.

        render(<FutureBoard onClose={() => { }} />);

        // Verify "Inbox (未定)" header exists
        expect(screen.getByText('Inbox (未定)')).toBeDefined();

        // Verify ONLY Inbox Item is in the list
        expect(screen.getByText('Inbox Item')).toBeDefined();

        // Others should NOT be present
        expect(screen.queryByText('Waiting Item')).toBeNull();
        expect(screen.queryByText('Hold Item')).toBeNull();
        expect(screen.queryByText('Intent Item')).toBeNull();
        expect(screen.queryByText('Scheduled Item')).toBeNull();
        expect(screen.queryByText('Today Item')).toBeNull();
    });

    it('includes unscheduled preparation items in Stock', () => {
        // Case: Item is in gdbPreparation (maybe moved there) but has prep_date removed (unscheduled)
        const unscheduledPrepItem: Item = { id: '7', title: 'Unscheduled Prep', status: 'inbox', prep_date: null, updatedAt: 100 };

        mockViewModel.gdbActive = [];
        mockViewModel.gdbPreparation = [unscheduledPrepItem];

        render(<FutureBoard onClose={() => { }} />);

        expect(screen.getByText('Unscheduled Prep')).toBeDefined();
    });
});
