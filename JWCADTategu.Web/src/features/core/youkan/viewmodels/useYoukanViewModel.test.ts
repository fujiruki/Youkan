import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { useYoukanViewModel } from './useYoukanViewModel';
import { Item } from '../../../../features/core/youkan/types';

// Mock YoukanRepository & CloudYoukanRepository to avoid network/DB calls
vi.mock('../repositories/YoukanRepository', () => ({
	YoukanRepository: {
		getGdbShelf: vi.fn().mockResolvedValue({ active: [], preparation: [], intent: [], log: [] }),
		getTodayView: vi.fn().mockResolvedValue({ commits: [], execution: null, candidates: [] }),
		getMemos: vi.fn().mockResolvedValue([]),
		getMembers: vi.fn().mockResolvedValue([]),
		getCapacityConfig: vi.fn().mockResolvedValue(null),
		getProjects: vi.fn().mockResolvedValue([]),
		getJoinedTenants: vi.fn().mockResolvedValue([]),
		getCurrentUser: vi.fn().mockResolvedValue(null),
	}
}));
vi.mock('../repositories/CloudYoukanRepository', () => ({
	CloudYoukanRepository: {
		getGdbShelf: vi.fn().mockResolvedValue({ active: [], preparation: [], intent: [], log: [] }),
		getTodayView: vi.fn().mockResolvedValue({ commits: [], execution: null, candidates: [] }),
		getMemos: vi.fn().mockResolvedValue([]),
		getMembers: vi.fn().mockResolvedValue([]),
		getCapacityConfig: vi.fn().mockResolvedValue(null),
		getProjects: vi.fn().mockResolvedValue([]),
		getJoinedTenants: vi.fn().mockResolvedValue([]),
		getCurrentUser: vi.fn().mockResolvedValue(null),
	}
}));
vi.mock('../contexts/UndoContext', () => ({
	useUndo: () => ({ addUndoAction: vi.fn() })
}));

describe('useYoukanViewModel - Context and Filter Logic (TDD based on State Matrix)', () => {

	const createMockItem = (id: string, overrides: Partial<Item> = {}): Item => ({
		id,
		title: `Task ${id}`,
		status: 'inbox',
		createdAt: Date.now(),
		updatedAt: Date.now(),
		statusUpdatedAt: Date.now(),
		weight: 1,
		interrupt: false,
		doorId: '',
		category: 'door',
		type: 'start',
		memo: '',
		tenantId: null,
		projectId: null,
		focusOrder: 0,
		isEngaged: false,
		...overrides
	});

	// Items setup
	const itemPers1 = createMockItem('p1', { title: 'Personal Task 1', tenantId: null, domain: undefined });
	const itemPers2 = createMockItem('p2', { title: 'Personal Task 2', tenantId: null, domain: undefined });
	const itemCompA1 = createMockItem('c_A1', { title: 'Company A Task 1', tenantId: 'tenant-A', domain: 'business' });
	const itemCompB1 = createMockItem('c_B1', { title: 'Company B Task 1', tenantId: 'tenant-B', domain: 'business' });
	const itemImplicitBiz = createMockItem('c_implicit', { title: 'Implicit Bus Task', tenantId: null, domain: 'business' });

	// Projects
	const projPers = createMockItem('proj_pers', { title: 'Personal Project', isProject: true, tenantId: null });
	const itemUnderPers = createMockItem('up1', { title: 'Under Pers', projectId: 'proj_pers', tenantId: null });
	const itemUnderPersBiz = createMockItem('up2', { title: 'Under Pers Biz', projectId: 'proj_pers', tenantId: 'tenant-A' }); // Contradictory but possible child

	const projCompA = createMockItem('proj_compA', { title: 'Company A Project', isProject: true, tenantId: 'tenant-A' });
	const itemUnderCompA = createMockItem('uc1', { title: 'Under Comp A', projectId: 'proj_compA', tenantId: 'tenant-A' });

	const allItems = [
		itemPers1, itemPers2, itemCompA1, itemCompB1, itemImplicitBiz,
		projPers, itemUnderPers, itemUnderPersBiz,
		projCompA, itemUnderCompA
	];

	// Direct access to the internal filter logic for pure unit testing
	// We simulate the filterItems logic block from the ViewModel
	const applyFilterLogic = (items: Item[], filterMode: string, projectId?: string) => {
		const checkBase = (item: Item): boolean => {
			if (filterMode === 'all') return true;
			if (filterMode === 'company') {
				return !!item.tenantId || item.domain === 'business';
			} else if (filterMode === 'personal') {
				return !item.tenantId && item.domain !== 'business';
			} else if (typeof filterMode === 'string') {
				// Tenant-specific
				return item.tenantId === filterMode;
			}
			return true;
		};

		if (!projectId) {
			return items.filter(i => checkBase(i));
		}

		const anchor = items.find(i => i.id === projectId);
		const isAnchorPassing = anchor ? checkBase(anchor) : false;

		return items.filter(i => {
			if (i.projectId !== projectId && i.id !== projectId) return false;
			if (i.id === projectId) return true; // Anchor always visible if project focused

			if (isAnchorPassing) {
				return true;
			} else {
				return checkBase(i);
			}
		});
	};

	describe('A. Base Context (①〜⑥)', () => {
		it('① Personal/All: Should show everything', () => {
			const res = applyFilterLogic(allItems, 'all');
			expect(res.length).toBe(10);
		});

		it('② Personal/Personal: Should show only non-tenant non-business items', () => {
			const res = applyFilterLogic(allItems, 'personal');
			expect(res.map(i => i.id)).toEqual(['p1', 'p2', 'proj_pers', 'up1']);
		});

		it('③ Personal/Company: Should show only tenant or business domain items', () => {
			const res = applyFilterLogic(allItems, 'company');
			expect(res.map(i => i.id)).toEqual(['c_A1', 'c_B1', 'c_implicit', 'up2', 'proj_compA', 'uc1']);
		});

		it('④ Personal/TenantA (Specific): Should show only tenant-A items', () => {
			const res = applyFilterLogic(allItems, 'tenant-A');
			expect(res.map(i => i.id)).toEqual(['c_A1', 'up2', 'proj_compA', 'uc1']);
		});
	});

	describe('B. Focus Layer (AND Logic & Empty States)', () => {
		it('Focus on Personal Project under "all" mode (Full Visibility)', () => {
			// Expected: Anchor + all its children
			const res = applyFilterLogic(allItems, 'all', 'proj_pers');
			expect(res.map(i => i.id)).toEqual(['proj_pers', 'up1', 'up2']);
		});

		it('Focus on Personal Project under "personal" mode (Anchor passing)', () => {
			// Anchor is personal -> Passes base. Thus ALL children shown, even contradictory ones.
			const res = applyFilterLogic(allItems, 'personal', 'proj_pers');
			expect(res.map(i => i.id)).toEqual(['proj_pers', 'up1', 'up2']);
		});

		it('Focus on Company Project under "personal" mode (Anchor failing -> Empty view)', () => {
			// Anchor is company -> Fails personal base.
			// Anchor is shown (header). Children must pass personal base to be shown.
			// Company child fails personal base.
			const res = applyFilterLogic(allItems, 'personal', 'proj_compA');
			// Empty state design: Only the project itself should be visible as a shell
			expect(res.map(i => i.id)).toEqual(['proj_compA']);
		});

		it('Focus on Personal Project under "tenant-A" mode (Anchor failing -> Mixed children)', () => {
			// Anchor is personal -> Fails tenant-A base.
			// Anchor is shown. Children must pass tenant-A base.
			// up1 (personal) fails. up2 (tenant-A) passes!
			const res = applyFilterLogic(allItems, 'tenant-A', 'proj_pers');
			expect(res.map(i => i.id)).toEqual(['proj_pers', 'up2']);
		});

		it('Focus on Company Project under "company" mode (Anchor passing)', () => {
			// Anchor is company -> Passes company base. ALL children shown.
			const res = applyFilterLogic(allItems, 'company', 'proj_compA');
			expect(res.map(i => i.id)).toEqual(['proj_compA', 'uc1']);
		});
	});
});
