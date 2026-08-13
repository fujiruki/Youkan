import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import React from 'react';
import { RyokanGanttView } from '../RyokanGanttView';
import { Item, Dependency, CapacityConfig } from '../../../types';
import { ToastProvider } from '../../../../../../contexts/ToastContext';

const mockGetDependencies = vi.fn();

vi.mock('../../../repositories/DependencyRepository', () => ({
	DependencyRepository: vi.fn().mockImplementation(function (this: any) {
		this.getDependencies = mockGetDependencies;
		this.createDependency = vi.fn();
		this.deleteDependency = vi.fn();
	}),
}));

/**
 * R-100: ガント完了表示モードで、完了アイテムのカレンダー要素（割当チップ・目安納期ハンドル）と
 * 依存関係矢印がグレー系に変わることを検証する。
 */

const renderWithProviders = (ui: React.ReactElement) =>
	render(<ToastProvider>{ui}</ToastProvider>);

const makeAllDays = (): Date[] => {
	const days: Date[] = [];
	for (let d = 1; d <= 31; d++) {
		days.push(new Date(2026, 2, d));
	}
	return days;
};

const makeItem = (id: string, title: string, overrides: Partial<Item> = {}): Item => ({
	id,
	title,
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
	due_date: '',
	flags: {},
	...overrides,
});

const makeDependency = (id: string, sourceItemId: string, targetItemId: string): Dependency => ({
	id,
	sourceItemId,
	targetItemId,
	createdAt: 0,
});

const capacityConfig: CapacityConfig = {
	defaultDailyMinutes: 480,
	holidays: [],
	exceptions: {},
};

// 2026-03-04 は水曜日（平日）
const wednesday = new Date(2026, 2, 4);
const wednesdayKey = wednesday.toDateString();
const wednesdayUnix = Math.floor(wednesday.getTime() / 1000);

// 2026-03-05 は木曜日（平日）
const thursday = new Date(2026, 2, 5);
const thursdayUnix = Math.floor(thursday.getTime() / 1000);

const defaultProps = {
	allDays: makeAllDays(),
	heatMap: new Map(),
	today: new Date(2026, 2, 15),
	safeConfig: {},
	rowHeight: 40,
	renderItemTitle: (item: Item) => item.title,
	showGroups: false,
	projects: [],
	capacityConfig,
	currentUserId: 'user1',
};

beforeEach(() => {
	vi.clearAllMocks();
	mockGetDependencies.mockResolvedValue([]);
});

describe('R-100: 完了アイテムの割当チップのグレー化', () => {
	it('未完了アイテムの割当チップはインディゴ系のまま', () => {
		const items = [
			makeItem('task-focus', '未完了タスク', {
				status: 'focus',
				prep_date: wednesdayUnix,
				estimatedMinutes: 90,
			}),
		];

		const { container } = renderWithProviders(<RyokanGanttView {...defaultProps} items={items} />);

		// data-gantt-date は日付ヘッダーとタスク行の日付セルの両方に付くため、行内に絞り込む
		const row = container.querySelector('[data-item-id="task-focus"]');
		const cell = row?.querySelector(`[data-gantt-date="${wednesdayKey}"]`);
		const chip = cell?.querySelector('[title^="割当"]');
		expect(chip).toBeTruthy();
		expect(chip?.className).toMatch(/bg-indigo-500/);
		expect(chip?.className).not.toMatch(/bg-slate-400/);
	});

	it('完了済みアイテムの割当チップはグレー系になる', () => {
		const items = [
			makeItem('task-done', '完了タスク', {
				status: 'done',
				prep_date: wednesdayUnix,
				estimatedMinutes: 90,
			}),
		];

		const { container } = renderWithProviders(<RyokanGanttView {...defaultProps} items={items} />);

		const row = container.querySelector('[data-item-id="task-done"]');
		const cell = row?.querySelector(`[data-gantt-date="${wednesdayKey}"]`);
		const chip = cell?.querySelector('[title^="割当"]');
		expect(chip).toBeTruthy();
		expect(chip?.className).toMatch(/bg-slate-400/);
		expect(chip?.className).not.toMatch(/bg-indigo-500/);
	});
});

describe('R-100: 完了アイテムの目安納期ハンドルのグレー化', () => {
	it('未完了アイテムの目安納期ハンドルはインディゴ系のまま', () => {
		const items = [makeItem('task-focus', '未完了タスク', { status: 'focus', prep_date: wednesdayUnix })];

		const { container } = renderWithProviders(<RyokanGanttView {...defaultProps} items={items} />);

		const handle = container.querySelector('[title^="目安納期"]');
		expect(handle).toBeTruthy();
		expect(handle?.className).toMatch(/bg-indigo-400/);
		expect(handle?.className).not.toMatch(/bg-slate-400/);
	});

	it('完了済みアイテムの目安納期ハンドルはグレー系になる', () => {
		const items = [makeItem('task-done', '完了タスク', { status: 'done', prep_date: wednesdayUnix })];

		const { container } = renderWithProviders(<RyokanGanttView {...defaultProps} items={items} />);

		const handle = container.querySelector('[title^="目安納期"]');
		expect(handle).toBeTruthy();
		expect(handle?.className).toMatch(/bg-slate-400/);
		expect(handle?.className).not.toMatch(/bg-indigo-400/);
	});
});

describe('R-100: 完了アイテムに接続する依存関係矢印のグレー化', () => {
	it('source/targetいずれも未完了なら矢印はインディゴ系のまま', async () => {
		mockGetDependencies.mockResolvedValue([makeDependency('dep-1', 'A', 'B')]);
		const items = [
			makeItem('A', 'タスクA', { status: 'focus', prep_date: wednesdayUnix }),
			makeItem('B', 'タスクB', { status: 'focus', prep_date: thursdayUnix }),
		];

		const { container } = renderWithProviders(<RyokanGanttView {...defaultProps} items={items} />);

		await waitFor(() => expect(mockGetDependencies).toHaveBeenCalled());
		await waitFor(() => expect(container.querySelector('svg path')).toBeTruthy());

		const path = container.querySelector('svg path');
		expect(path?.getAttribute('stroke')).toBe('#6366f1');
	});

	it('targetが完了済みなら矢印はグレー系になる', async () => {
		mockGetDependencies.mockResolvedValue([makeDependency('dep-1', 'A', 'B')]);
		const items = [
			makeItem('A', 'タスクA', { status: 'focus', prep_date: wednesdayUnix }),
			makeItem('B', 'タスクB', { status: 'done', prep_date: thursdayUnix }),
		];

		const { container } = renderWithProviders(<RyokanGanttView {...defaultProps} items={items} />);

		await waitFor(() => expect(mockGetDependencies).toHaveBeenCalled());
		await waitFor(() => expect(container.querySelector('svg path')).toBeTruthy());

		const path = container.querySelector('svg path');
		expect(path?.getAttribute('stroke')).not.toBe('#6366f1');
	});

	it('sourceが完了済みなら矢印はグレー系になる', async () => {
		mockGetDependencies.mockResolvedValue([makeDependency('dep-1', 'A', 'B')]);
		const items = [
			makeItem('A', 'タスクA', { status: 'done', prep_date: wednesdayUnix }),
			makeItem('B', 'タスクB', { status: 'focus', prep_date: thursdayUnix }),
		];

		const { container } = renderWithProviders(<RyokanGanttView {...defaultProps} items={items} />);

		await waitFor(() => expect(mockGetDependencies).toHaveBeenCalled());
		await waitFor(() => expect(container.querySelector('svg path')).toBeTruthy());

		const path = container.querySelector('svg path');
		expect(path?.getAttribute('stroke')).not.toBe('#6366f1');
	});
});
