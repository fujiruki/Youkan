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
 * R-105: ウィークリー/デイリー表示（timelineMode）で、タスクが所要時間比例の幅と
 * 開始オフセット位置を持つブロックとして描画されることを検証する。
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
const wednesdayYmd = '2026-03-04';
const wednesdayUnix = Math.floor(wednesday.getTime() / 1000);

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

const pct = (value: string | undefined) => parseFloat(value || '');

beforeEach(() => {
	vi.clearAllMocks();
	mockGetDependencies.mockResolvedValue([]);
});

describe('R-105: timelineMode 未指定時の後方互換', () => {
	it('従来の日次チップ表示のままで、タイムラインブロックは描画されない', () => {
		const items = [
			makeItem('task-1', 'タスク1', { prep_date: wednesdayUnix, estimatedMinutes: 240 }),
		];

		const { container } = renderWithProviders(<RyokanGanttView {...defaultProps} items={items} />);

		const row = container.querySelector('[data-item-id="task-1"]');
		const cell = row?.querySelector(`[data-gantt-date="${wednesdayKey}"]`);
		expect(cell?.querySelector('[title^="割当"]')?.className).toMatch(/w-4 h-4/);
		expect(container.querySelector(`[data-testid="gantt-time-block-task-1-${wednesdayYmd}"]`)).toBeNull();
	});
});

describe('R-105: timelineMode のブロック描画', () => {
	it('ブロック幅は「その日の割当分 ÷ 1440分」の比率になる', () => {
		const items = [
			makeItem('task-1', 'タスク1', { prep_date: wednesdayUnix, estimatedMinutes: 240 }),
		];

		const { container } = renderWithProviders(
			<RyokanGanttView {...defaultProps} items={items} timelineMode />
		);

		const block = container.querySelector<HTMLElement>(
			`[data-testid="gantt-time-block-task-1-${wednesdayYmd}"]`
		);
		expect(block).toBeTruthy();
		expect(pct(block!.style.left)).toBeCloseTo(0, 3);
		expect(pct(block!.style.width)).toBeCloseTo((240 / 1440) * 100, 3);
	});

	it('従来の日次チップは timelineMode では描画されない', () => {
		const items = [
			makeItem('task-1', 'タスク1', { prep_date: wednesdayUnix, estimatedMinutes: 240 }),
		];

		const { container } = renderWithProviders(
			<RyokanGanttView {...defaultProps} items={items} timelineMode />
		);

		const row = container.querySelector('[data-item-id="task-1"]');
		expect(row?.querySelector('[title^="割当"].w-4')).toBeNull();
	});

	it('同日に先行する依存タスクがあれば、その直後の位置から描画される', async () => {
		mockGetDependencies.mockResolvedValue([makeDependency('dep-1', 'A', 'B')]);
		const items = [
			makeItem('A', 'タスクA', { prep_date: wednesdayUnix, estimatedMinutes: 240 }),
			makeItem('B', 'タスクB', { prep_date: wednesdayUnix, estimatedMinutes: 120 }),
		];

		const { container } = renderWithProviders(
			<RyokanGanttView {...defaultProps} items={items} timelineMode />
		);

		await waitFor(() => expect(mockGetDependencies).toHaveBeenCalled());
		await waitFor(() => {
			const b = container.querySelector<HTMLElement>(
				`[data-testid="gantt-time-block-B-${wednesdayYmd}"]`
			);
			expect(pct(b!.style.left)).toBeCloseTo((240 / 1440) * 100, 3);
		});

		const a = container.querySelector<HTMLElement>(
			`[data-testid="gantt-time-block-A-${wednesdayYmd}"]`
		);
		expect(pct(a!.style.left)).toBeCloseTo(0, 3);
	});

	it('meta.gantt_time_blocks に保存された手動オフセットが再現される', () => {
		const items = [
			makeItem('task-1', 'タスク1', {
				prep_date: wednesdayUnix,
				estimatedMinutes: 240,
				meta: { gantt_time_blocks: { [wednesdayYmd]: 540 } },
			}),
		];

		const { container } = renderWithProviders(
			<RyokanGanttView {...defaultProps} items={items} timelineMode />
		);

		const block = container.querySelector<HTMLElement>(
			`[data-testid="gantt-time-block-task-1-${wednesdayYmd}"]`
		);
		expect(pct(block!.style.left)).toBeCloseTo((540 / 1440) * 100, 3);
	});

	it('24時間をはみ出す場合は右端が日末尾に揃い、警告マークが表示される', () => {
		const items = [
			makeItem('task-1', 'タスク1', {
				prep_date: wednesdayUnix,
				estimatedMinutes: 480,
				meta: { gantt_time_blocks: { [wednesdayYmd]: 1320 } },
			}),
		];

		const { container } = renderWithProviders(
			<RyokanGanttView {...defaultProps} items={items} timelineMode />
		);

		const block = container.querySelector<HTMLElement>(
			`[data-testid="gantt-time-block-task-1-${wednesdayYmd}"]`
		);
		expect(pct(block!.style.left)).toBeCloseTo((1320 / 1440) * 100, 3);
		expect(pct(block!.style.left) + pct(block!.style.width)).toBeCloseTo(100, 3);
		expect(block!.textContent).toContain('❗️');
	});
});

describe('R-105: 行スクロールコンテンツの横幅', () => {
	// content-visibility: auto の行は幅方向にもサイズ拘束されるため、初回描画では
	// 親の max-content 計算がビューポート幅に潰れ sticky ラベル列が画面外へ出る。
	// 明示幅を持たせて max-content 依存をなくす。
	it.each([24, 96])('スクロールコンテンツに明示幅（ラベル列256px + 日数×列幅）を持つ colWidth=%i', (colWidth) => {
		const { container } = renderWithProviders(
			<RyokanGanttView {...defaultProps} colWidth={colWidth} items={[]} timelineMode />
		);

		const wrapper = container.querySelector<HTMLElement>('.min-w-max');
		expect(wrapper!.style.width).toBe(`${256 + defaultProps.allDays.length * colWidth}px`);
	});
});
