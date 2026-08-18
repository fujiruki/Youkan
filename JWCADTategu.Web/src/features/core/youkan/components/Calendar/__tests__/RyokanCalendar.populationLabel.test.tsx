import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import React from 'react';
import { RyokanCalendar } from '../RyokanCalendar';
import { Item } from '../../../types';

/**
 * R-148: グリッド（量感カレンダー）の CapacityBar には母集団ラベルを title で付ける。
 * 分子は「予定込」（Google予定を加算）、完了込／未完了のみは includesCompleted、
 * 分母はスコープ（filterMode）で「全体枠／個人枠／会社枠」。
 */

const mockGetDependencies = vi.fn();

vi.mock('../../../repositories/DependencyRepository', () => ({
	DependencyRepository: vi.fn().mockImplementation(function (this: any) {
		this.getDependencies = mockGetDependencies;
	}),
}));

const capacityConfig = {
	defaultDailyMinutes: 480,
	holidays: [] as string[],
	exceptions: {} as Record<string, number>
};

const item: Item = {
	id: 'i1',
	title: 'Item',
	status: 'focus',
	focusOrder: 0,
	isEngaged: false,
	statusUpdatedAt: 0,
	interrupt: false,
	weight: 2,
	parentId: null,
	projectId: null,
	createdAt: 0,
	updatedAt: 0,
	memo: '',
	due_date: '2026-02-09',
	estimatedMinutes: 120,
	flags: {},
};

const baseProps = {
	completedItems: [],
	members: [],
	projects: [],
	capacityConfig,
	joinedTenants: [],
	currentUserId: 'u1',
	items: [item],
	displayMode: 'grid' as const,
	focusDate: new Date(2026, 1, 9),
	hideHeader: true,
};

const firstBarTitle = async (container: HTMLElement) => {
	await waitFor(() => expect(container.querySelector('[data-testid="capacity-bar"]')).not.toBeNull());
	return container.querySelector('[data-testid="capacity-bar"]')!.getAttribute('title');
};

describe('R-148: グリッド CapacityBar の母集団ラベル', () => {
	beforeEach(() => {
		mockGetDependencies.mockReset();
		mockGetDependencies.mockResolvedValue([]);
	});

	it('既定（filterMode=all・完了込）は「予定込／完了込／全体枠」', async () => {
		const { container } = render(<RyokanCalendar {...baseProps} />);
		expect(await firstBarTitle(container)).toBe('予定込／完了込／全体枠');
	});

	it('filterMode=personal は「個人枠」', async () => {
		const { container } = render(<RyokanCalendar {...baseProps} filterMode="personal" />);
		expect(await firstBarTitle(container)).toBe('予定込／完了込／個人枠');
	});

	it('filterMode=company・includesCompleted=false は「予定込／未完了のみ／会社枠」', async () => {
		const { container } = render(<RyokanCalendar {...baseProps} filterMode="company" includesCompleted={false} />);
		expect(await firstBarTitle(container)).toBe('予定込／未完了のみ／会社枠');
	});
});
