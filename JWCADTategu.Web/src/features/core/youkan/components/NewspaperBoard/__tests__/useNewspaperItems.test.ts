import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useNewspaperItems, NewspaperItemWrapper } from '../useNewspaperItems';
import { Item, Project } from '../../../types';

// Mock Data (Projects as Items)
const mockProjects: any[] = [
    { id: 'p1', title: 'Company Project A', tenantId: 't1', isProject: true },
    { id: 'p2', title: 'Personal Project B', tenantId: undefined, isProject: true },
];

const mockItems: Item[] = [
    { id: '1', title: 'Inbox Item 1', status: 'inbox', projectId: null, createdAt: 1000, updatedAt: 1000, statusUpdatedAt: 1000, focusOrder: 0, isEngaged: false, interrupt: false, weight: 1 },
    { id: '2', title: 'Proj A Item', status: 'pending', projectId: 'p1', createdAt: 2000, updatedAt: 2000, statusUpdatedAt: 2000, focusOrder: 0, isEngaged: false, interrupt: false, weight: 1 },
    { id: '3', title: 'Proj B Item', status: 'focus', projectId: 'p2', createdAt: 3000, updatedAt: 3000, statusUpdatedAt: 3000, focusOrder: 0, isEngaged: false, interrupt: false, weight: 1 },
    { id: '4', title: 'Inbox Item 2', status: 'inbox', projectId: null, createdAt: 4000, updatedAt: 4000, statusUpdatedAt: 4000, focusOrder: 0, isEngaged: false, interrupt: false, weight: 1 },
];

// Mock ViewModel
const mockViewModel = {
    gdbActive: [mockItems[0], mockItems[3]], // Inbox items
    gdbPreparation: [mockItems[1]], // Pending/Prep items
    gdbIntent: [mockItems[2]], // Focus/Intent items
    gdbLog: [{ id: '99', title: 'Done Item', status: 'done', projectId: 'p1', isProject: false } as any],
    allProjects: mockProjects,
    joinedTenants: [{ id: 't1', name: 'Company T', role: 'admin' }]
};

describe('useNewspaperItems', () => {
    it('should sort items correctly: No Project -> Company Project -> Personal Project', () => {
        const { result } = renderHook(() => useNewspaperItems(mockViewModel as any));

        const items: NewspaperItemWrapper[] = result.current;

        // Expectation:
        // 1. Inbox Item 1 (No Project)
        // 2. Inbox Item 2 (No Project)
        // 3. Header: Company Project A
        // 4. Proj A Item
        // 5. Header: Personal Project B
        // 6. Proj B Item

        // Verify "No Project" items come first
        const firstTwo = items.slice(0, 2);
        expect(firstTwo.every(i => i.type !== 'header' && !i.item.projectId)).toBe(true);

        // Verify Company Project comes next
        const compHeaderIndex = items.findIndex(i => i.type === 'header' && i.project?.id === 'p1');
        expect(compHeaderIndex).toBeGreaterThan(1); // After inbox items

        // Verify Item follows header
        expect(items[compHeaderIndex + 1].item.id).toBe('2'); // Proj A Item
        // Verify Done Item is also present for Project A
        // The order between '2' and '99' depends on iteration order or logic.
        // Since we just push, they should be both in the list.
        const projAItems = items.filter(i => i.project?.id === 'p1' && i.type !== 'header');
        expect(projAItems.find(i => i.item.id === '99')).toBeDefined();
        expect(projAItems.find(i => i.item.id === '2')).toBeDefined();

        // Verify Personal Project comes last
        const persHeaderIndex = items.findIndex(i => i.type === 'header' && i.project?.id === 'p2');
        expect(persHeaderIndex).toBeGreaterThan(compHeaderIndex);

        // Verify Item follows header
        expect(items[persHeaderIndex + 1].item.id).toBe('3'); // Proj B Item
    });

    it('should generate virtual headers for projects with items', () => {
        const { result } = renderHook(() => useNewspaperItems(mockViewModel as any));
        const headers = result.current.filter(i => i.type === 'header');
        expect(headers.length).toBe(2);
        expect(headers[0].project?.title).toBe('Company Project A');
        expect(headers[1].project?.title).toBe('Personal Project B');
    });
});
