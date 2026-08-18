import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import React from 'react';
import { RyokanCalendar } from '../RyokanCalendar';
import { Item } from '../../../types';

/**
 * R-137: 他人アイテムの秘匿表示（Relaxed Privacy Logic）は currentUserId prop のみで
 * 判定する。localStorage['youkan_user']（Cookieセッション認証では常に空）へのフォールバックを
 * 廃止しても、currentUserId prop から正しく「自分のアイテムか」を判定できることを確認する。
 */

const mockGetDependencies = vi.fn();

vi.mock('../../../repositories/DependencyRepository', () => ({
	DependencyRepository: vi.fn().mockImplementation(function (this: any) {
		this.getDependencies = mockGetDependencies;
	}),
}));

const minimalCapacityConfig = {
	defaultDailyMinutes: 480,
	holidays: [] as string[],
	exceptions: {} as Record<string, number>
};

const makeItem = (id: string, dueDate: string, createdBy?: string): Item => ({
	id,
	title: `Item ${id}`,
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
	due_date: dueDate,
	flags: {},
	createdBy,
});

const baseProps = {
	completedItems: [],
	members: [],
	projects: [],
	capacityConfig: minimalCapacityConfig,
	joinedTenants: [],
};

describe('R-137: RyokanCalendar の他人アイテム秘匿表示は currentUserId prop のみで判定する', () => {
	beforeEach(() => {
		mockGetDependencies.mockReset();
		mockGetDependencies.mockResolvedValue([]);
		localStorage.clear();
	});

	it('localStorageにyoukan_userが無くても、currentUserId propが自分のアイテムは実タイトルを表示する', async () => {
		const focusDate = new Date(2026, 1, 9); // 2026-02-09
		const myItem = makeItem('mine', '2026-02-09', 'test-user');

		const { container } = render(
			<RyokanCalendar
				{...baseProps}
				currentUserId="test-user"
				items={[myItem]}
				displayMode="grid"
				focusDate={focusDate}
				hideHeader={true}
			/>
		);

		await waitFor(() => expect(container.querySelector('#cal-chip-mine')).not.toBeNull());
		expect(container.querySelector('#cal-chip-mine')?.textContent).toContain('Item mine');
	});

	it('localStorageにyoukan_userが無くても、currentUserId propが他人のアイテムは「予定あり」に秘匿表示される', async () => {
		const focusDate = new Date(2026, 1, 9); // 2026-02-09
		const otherItem = makeItem('other', '2026-02-09', 'other-user');

		const { container } = render(
			<RyokanCalendar
				{...baseProps}
				currentUserId="test-user"
				items={[otherItem]}
				displayMode="grid"
				focusDate={focusDate}
				hideHeader={true}
			/>
		);

		await waitFor(() => expect(container.querySelector('#cal-chip-other')).not.toBeNull());
		const text = container.querySelector('#cal-chip-other')?.textContent || '';
		expect(text).toContain('予定あり');
		expect(text).not.toContain('Item other');
	});
});
