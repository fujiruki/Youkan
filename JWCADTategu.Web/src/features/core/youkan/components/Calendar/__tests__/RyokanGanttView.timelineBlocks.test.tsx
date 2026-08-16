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

describe('R-105-Y2: 時間軸ブロックの目安時間表示', () => {
	it('ブロック中央に割当時間が「Xh」で表示される', () => {
		const items = [
			makeItem('task-1', 'タスク1', { prep_date: wednesdayUnix, estimatedMinutes: 240 }),
		];

		const { container } = renderWithProviders(
			<RyokanGanttView {...defaultProps} items={items} timelineMode />
		);

		const block = container.querySelector<HTMLElement>(
			`[data-testid="gantt-time-block-task-1-${wednesdayYmd}"]`
		);
		expect(block!.textContent).toContain('4h');
	});

	it('60分未満の割当では時間ラベルを表示しない', () => {
		const items = [
			makeItem('task-1', 'タスク1', { prep_date: wednesdayUnix, estimatedMinutes: 30 }),
		];

		const { container } = renderWithProviders(
			<RyokanGanttView {...defaultProps} items={items} timelineMode />
		);

		const block = container.querySelector<HTMLElement>(
			`[data-testid="gantt-time-block-task-1-${wednesdayYmd}"]`
		);
		expect(block!.textContent).not.toMatch(/h/);
	});
});

describe('R-105-Y2: 依存矢印のブロック端合わせ', () => {
	const thursdayUnix = Math.floor(new Date(2026, 2, 5).getTime() / 1000);
	const colWidth = 96;
	const STICKY = 256;

	// d 属性の始点（M x y）と終点（末尾の x y）を取り出す
	const parseEndpoints = (d: string) => {
		const nums = d.match(/-?\d+(\.\d+)?/g)!.map(Number);
		return { x1: nums[0], x2: nums[nums.length - 2] };
	};

	const getArrow = (container: HTMLElement) =>
		container.querySelector<SVGPathElement>('svg path');

	it('timelineMode ではソースの右端・ターゲットの左端がブロック端になる', async () => {
		mockGetDependencies.mockResolvedValue([makeDependency('dep-1', 'A', 'B')]);
		const items = [
			makeItem('A', 'タスクA', { prep_date: wednesdayUnix, estimatedMinutes: 240 }),
			makeItem('B', 'タスクB', {
				prep_date: thursdayUnix,
				estimatedMinutes: 120,
				meta: { gantt_time_blocks: { '2026-03-05': 300 } },
			}),
		];

		const { container } = renderWithProviders(
			<RyokanGanttView {...defaultProps} items={items} colWidth={colWidth} timelineMode />
		);

		await waitFor(() => expect(getArrow(container)).toBeTruthy());
		await waitFor(() => {
			const { x1, x2 } = parseEndpoints(getArrow(container)!.getAttribute('d')!);
			// A: 3日目セル + 割当240分ぶんの右端
			expect(x1).toBeCloseTo(STICKY + 3 * colWidth + (240 / 1440) * colWidth, 3);
			// B: 4日目セル + 手動オフセット300分の左端
			expect(x2).toBeCloseTo(STICKY + 4 * colWidth + (300 / 1440) * colWidth, 3);
		});
	});

	it('ブロックが無い日は従来どおり日付セル端にフォールバックする', async () => {
		mockGetDependencies.mockResolvedValue([makeDependency('dep-1', 'A', 'C')]);
		const items = [
			makeItem('A', 'タスクA', { prep_date: wednesdayUnix, estimatedMinutes: 240 }),
			// prep_date 無し＝割当が無いためブロックも無い
			makeItem('C', 'タスクC', { due_date: '2026-03-05' }),
		];

		const { container } = renderWithProviders(
			<RyokanGanttView {...defaultProps} items={items} colWidth={colWidth} timelineMode />
		);

		await waitFor(() => expect(getArrow(container)).toBeTruthy());
		await waitFor(() => {
			const { x2 } = parseEndpoints(getArrow(container)!.getAttribute('d')!);
			expect(x2).toBeCloseTo(STICKY + 4 * colWidth, 3);
		});
	});

	// prep_date 当日にキャパシティが無いと、ブロックはそれ以前の稼働日へ前倒し配置される。
	// このとき prep_date の日を見に行くとブロックが見つからず、セル端フォールバックと
	// ブロック端が混在した不整合な矢印になっていた。
	it('ブロックが prep_date より前の日へ前倒し配置されても、その実ブロック端を使う', async () => {
		mockGetDependencies.mockResolvedValue([makeDependency('dep-1', 'A', 'B')]);
		const noCapacity: CapacityConfig = {
			...capacityConfig,
			exceptions: { '2026-03-04': 0, '2026-03-05': 0 },
		};
		const items = [
			// prep_date は 3/5 だがキャパ0のため 3/3 へ前倒しされる
			makeItem('A', 'タスクA', { prep_date: thursdayUnix, estimatedMinutes: 240 }),
			makeItem('B', 'タスクB', {
				prep_date: Math.floor(new Date(2026, 2, 6).getTime() / 1000),
				estimatedMinutes: 120,
				meta: { gantt_time_blocks: { '2026-03-06': 300 } },
			}),
		];

		const { container } = renderWithProviders(
			<RyokanGanttView {...defaultProps} capacityConfig={noCapacity} items={items} colWidth={colWidth} timelineMode />
		);

		await waitFor(() => expect(getArrow(container)).toBeTruthy());
		await waitFor(() => {
			const { x1, x2 } = parseEndpoints(getArrow(container)!.getAttribute('d')!);
			// A の実ブロックは 3/3（2日目セル）にある
			expect(x1).toBeCloseTo(STICKY + 2 * colWidth + (240 / 1440) * colWidth, 3);
			expect(x2).toBeCloseTo(STICKY + 5 * colWidth + (300 / 1440) * colWidth, 3);
		});
	});

	it('timelineMode でなければ従来どおり日付セル端を使う', async () => {
		mockGetDependencies.mockResolvedValue([makeDependency('dep-1', 'A', 'B')]);
		const items = [
			makeItem('A', 'タスクA', { prep_date: wednesdayUnix, estimatedMinutes: 240 }),
			makeItem('B', 'タスクB', {
				prep_date: thursdayUnix,
				estimatedMinutes: 120,
				meta: { gantt_time_blocks: { '2026-03-05': 300 } },
			}),
		];

		const { container } = renderWithProviders(
			<RyokanGanttView {...defaultProps} items={items} colWidth={colWidth} />
		);

		await waitFor(() => expect(getArrow(container)).toBeTruthy());
		await waitFor(() => {
			const { x1, x2 } = parseEndpoints(getArrow(container)!.getAttribute('d')!);
			expect(x1).toBeCloseTo(STICKY + 4 * colWidth, 3);
			expect(x2).toBeCloseTo(STICKY + 4 * colWidth, 3);
		});
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
