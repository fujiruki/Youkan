import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import React from 'react';
import { RyokanCalendar } from '../RyokanCalendar';
import { Item, Dependency } from '../../../types';

/**
 * R-091: グリッド/タイムラインビューでも依存関係のあるタスクの前後の序列を崩さずに並べる。
 *
 * QuantityEngine.calculateMetrics 側のソート実装は QuantityEngine.test.ts で検証済みのため、
 * ここでは RyokanCalendar が /dependencies を画面表示時に1回だけ取得し、
 * QuantityEngine へ正しく渡していることを確認する。
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

const makeItem = (id: string, dueDate: string): Item => ({
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
});

const makeDependency = (id: string, sourceItemId: string, targetItemId: string): Dependency => ({
	id,
	sourceItemId,
	targetItemId,
	createdAt: 0,
});

const baseProps = {
	completedItems: [],
	members: [],
	projects: [],
	capacityConfig: minimalCapacityConfig,
	joinedTenants: [],
	currentUserId: 'test-user'
};

describe('R-091: RyokanCalendar 依存関係データの取得と反映', () => {
	beforeEach(() => {
		mockGetDependencies.mockReset();
		mockGetDependencies.mockResolvedValue([]);
	});

	it('グリッドモードでマウント時に getDependencies が1回だけ呼ばれる', async () => {
		const focusDate = new Date(2026, 1, 9); // 2026-02-09

		render(
			<RyokanCalendar
				{...baseProps}
				items={[]}
				displayMode="grid"
				focusDate={focusDate}
				hideHeader={true}
			/>
		);

		await waitFor(() => expect(mockGetDependencies).toHaveBeenCalledTimes(1));
	});

	it('同じ納期に依存関係のあるアイテムが混在する場合、セル内チップが依存元→依存先の順で表示される', async () => {
		// items配列の並びはあえて依存関係と逆順にする
		const succItem = makeItem('succ', '2026-02-09');
		const predItem = makeItem('pred', '2026-02-09');
		const focusDate = new Date(2026, 1, 9);

		mockGetDependencies.mockResolvedValue([
			makeDependency('dep-1', 'pred', 'succ'),
		]);

		const { container } = render(
			<RyokanCalendar
				{...baseProps}
				items={[succItem, predItem]}
				displayMode="grid"
				focusDate={focusDate}
				hideHeader={true}
			/>
		);

		await waitFor(() => {
			const predChip = container.querySelector('#cal-chip-pred');
			const succChip = container.querySelector('#cal-chip-succ');
			expect(predChip).not.toBeNull();
			expect(succChip).not.toBeNull();
		});

		const chips = Array.from(container.querySelectorAll('[id^="cal-chip-"]'));
		const predIndex = chips.findIndex(c => c.id === 'cal-chip-pred');
		const succIndex = chips.findIndex(c => c.id === 'cal-chip-succ');
		expect(predIndex).toBeLessThan(succIndex);
	});
});
