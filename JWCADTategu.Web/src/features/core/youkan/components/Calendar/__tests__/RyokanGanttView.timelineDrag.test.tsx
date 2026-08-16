import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { RyokanGanttView } from '../RyokanGanttView';
import { Item, CapacityConfig } from '../../../types';
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
 * R-105: 時間軸タイムラインのブロックを横ドラッグすると、開始オフセット分が
 * meta.gantt_time_blocks へ保存されることを検証する。
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

const capacityConfig: CapacityConfig = {
	defaultDailyMinutes: 480,
	holidays: [],
	exceptions: {},
};

const wednesday = new Date(2026, 2, 4);
const wednesdayYmd = '2026-03-04';
const wednesdayUnix = Math.floor(wednesday.getTime() / 1000);

// 列幅 1440px = 1px あたり 1 分。ドラッグ量の検証を単純化する
const COL_WIDTH = 1440;

const defaultProps = {
	allDays: makeAllDays(),
	heatMap: new Map(),
	today: new Date(2026, 2, 15),
	safeConfig: {},
	rowHeight: 40,
	colWidth: COL_WIDTH,
	renderItemTitle: (item: Item) => item.title,
	showGroups: false,
	projects: [],
	capacityConfig,
	currentUserId: 'user1',
	timelineMode: true,
};

const dragBlock = (block: Element, deltaPx: number) => {
	fireEvent.mouseDown(block, { clientX: 100 });
	fireEvent.mouseMove(window, { clientX: 100 + deltaPx });
	fireEvent.mouseUp(window, { clientX: 100 + deltaPx });
};

beforeEach(() => {
	vi.clearAllMocks();
	mockGetDependencies.mockResolvedValue([]);
});

describe('R-105: タイムラインブロックのドラッグ', () => {
	it('右へドラッグすると開始オフセット分が meta.gantt_time_blocks に保存される', async () => {
		const onUpdateItem = vi.fn().mockResolvedValue(undefined);
		const items = [makeItem('task-1', 'タスク1', { prep_date: wednesdayUnix, estimatedMinutes: 240 })];

		const { container } = renderWithProviders(
			<RyokanGanttView {...defaultProps} items={items} onUpdateItem={onUpdateItem} />
		);

		const block = container.querySelector(`[data-testid="gantt-time-block-task-1-${wednesdayYmd}"]`)!;
		dragBlock(block, 120);

		await waitFor(() => expect(onUpdateItem).toHaveBeenCalledTimes(1));
		expect(onUpdateItem).toHaveBeenCalledWith('task-1', {
			meta: { gantt_time_blocks: { [wednesdayYmd]: 120 } },
		});
	});

	it('既存の meta を保持したままマージされる', async () => {
		const onUpdateItem = vi.fn().mockResolvedValue(undefined);
		const items = [
			makeItem('task-1', 'タスク1', {
				prep_date: wednesdayUnix,
				estimatedMinutes: 240,
				meta: { flow_x: 250, flow_y: 100, gantt_time_blocks: { '2026-03-05': 60 } },
			}),
		];

		const { container } = renderWithProviders(
			<RyokanGanttView {...defaultProps} items={items} onUpdateItem={onUpdateItem} />
		);

		const block = container.querySelector(`[data-testid="gantt-time-block-task-1-${wednesdayYmd}"]`)!;
		dragBlock(block, 60);

		await waitFor(() => expect(onUpdateItem).toHaveBeenCalledTimes(1));
		expect(onUpdateItem).toHaveBeenCalledWith('task-1', {
			meta: {
				flow_x: 250,
				flow_y: 100,
				gantt_time_blocks: { '2026-03-05': 60, [wednesdayYmd]: 60 },
			},
		});
	});

	it('左端を越えて左へドラッグしても 0 分にクランプされる', async () => {
		const onUpdateItem = vi.fn().mockResolvedValue(undefined);
		const items = [
			makeItem('task-1', 'タスク1', {
				prep_date: wednesdayUnix,
				estimatedMinutes: 240,
				meta: { gantt_time_blocks: { [wednesdayYmd]: 60 } },
			}),
		];

		const { container } = renderWithProviders(
			<RyokanGanttView {...defaultProps} items={items} onUpdateItem={onUpdateItem} />
		);

		const block = container.querySelector(`[data-testid="gantt-time-block-task-1-${wednesdayYmd}"]`)!;
		dragBlock(block, -600);

		await waitFor(() => expect(onUpdateItem).toHaveBeenCalledTimes(1));
		expect(onUpdateItem).toHaveBeenCalledWith('task-1', {
			meta: { gantt_time_blocks: { [wednesdayYmd]: 0 } },
		});
	});

	it('右端を越えて右へドラッグしても 1439 分にクランプされる', async () => {
		const onUpdateItem = vi.fn().mockResolvedValue(undefined);
		const items = [makeItem('task-1', 'タスク1', { prep_date: wednesdayUnix, estimatedMinutes: 240 })];

		const { container } = renderWithProviders(
			<RyokanGanttView {...defaultProps} items={items} onUpdateItem={onUpdateItem} />
		);

		const block = container.querySelector(`[data-testid="gantt-time-block-task-1-${wednesdayYmd}"]`)!;
		dragBlock(block, 2000);

		await waitFor(() => expect(onUpdateItem).toHaveBeenCalledTimes(1));
		expect(onUpdateItem).toHaveBeenCalledWith('task-1', {
			meta: { gantt_time_blocks: { [wednesdayYmd]: 1439 } },
		});
	});

	it('移動量が 0 分ならAPI更新を行わない', async () => {
		const onUpdateItem = vi.fn().mockResolvedValue(undefined);
		const items = [makeItem('task-1', 'タスク1', { prep_date: wednesdayUnix, estimatedMinutes: 240 })];

		const { container } = renderWithProviders(
			<RyokanGanttView {...defaultProps} items={items} onUpdateItem={onUpdateItem} />
		);

		const block = container.querySelector(`[data-testid="gantt-time-block-task-1-${wednesdayYmd}"]`)!;
		dragBlock(block, 0);

		expect(onUpdateItem).not.toHaveBeenCalled();
	});
});
