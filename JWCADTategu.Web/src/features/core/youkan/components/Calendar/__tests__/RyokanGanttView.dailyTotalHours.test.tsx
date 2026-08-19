import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';
import { RyokanGanttView } from '../RyokanGanttView';
import { Item, CapacityConfig } from '../../../types';
import { ToastProvider } from '../../../../../../contexts/ToastContext';

const renderWithProviders = (ui: React.ReactElement) =>
	render(<ToastProvider>{ui}</ToastProvider>);

/**
 * R-087: ガント一覧の日付ヘッダーに、その日の合計割当時間（CapacityBar直下）を表示する
 */

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
	status: 'inbox',
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

// 2026-03-04 は水曜日（平日）
const wednesday = new Date(2026, 2, 4);
const wednesdayKey = wednesday.toDateString();

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

describe('R-087: ガント日付ヘッダーの合計時間数表示', () => {
	it('その日の合計割当が90分のとき「1.5h」を表示する', () => {
		const items = [
			makeItem('task-90', '90分タスク', {
				prep_date: Math.floor(wednesday.getTime() / 1000),
				estimatedMinutes: 90,
			}),
		];

		const { container } = renderWithProviders(<RyokanGanttView {...defaultProps} items={items} />);

		const cell = container.querySelector(`[data-gantt-date="${wednesdayKey}"]`);
		expect(cell).toBeInTheDocument();
		expect(cell?.textContent).toContain('1.5h');
	});

	it('その日の合計割当が120分のとき「2h」を表示する', () => {
		const items = [
			makeItem('task-120', '120分タスク', {
				prep_date: Math.floor(wednesday.getTime() / 1000),
				estimatedMinutes: 120,
			}),
		];

		const { container } = renderWithProviders(<RyokanGanttView {...defaultProps} items={items} />);

		const cell = container.querySelector(`[data-gantt-date="${wednesdayKey}"]`);
		expect(cell?.textContent).toContain('2h');
	});

	it('割当が0分の日は時間数テキストを表示しない', () => {
		const { container } = renderWithProviders(<RyokanGanttView {...defaultProps} items={[]} />);

		const cell = container.querySelector(`[data-gantt-date="${wednesdayKey}"]`);
		expect(cell).toBeInTheDocument();
		expect(cell?.querySelector('[data-testid^="gantt-daily-total-"]')).toBeNull();
	});
});

/**
 * R-146: プロジェクト別表示（showGroups=true）でも合計時間・CapacityBar を表示する。
 * 集計対象はガントに渡された items（プロジェクト絞り込みは上流の API 取得時点で済んでいる）。
 */
describe('R-146: プロジェクト別表示でも日付ヘッダーの合計時間を表示', () => {
	const projects = [{ id: 'p1', title: 'プロジェクトA' }, { id: 'p2', title: 'プロジェクトB' }] as any;

	it('showGroups=true で合計時間テキストと CapacityBar が表示される', () => {
		const items = [
			makeItem('task-90', '90分タスク', {
				projectId: 'p1',
				prep_date: Math.floor(wednesday.getTime() / 1000),
				estimatedMinutes: 90,
			}),
		];

		const { container } = renderWithProviders(
			<RyokanGanttView {...defaultProps} showGroups={true} projects={projects} items={items} />
		);

		const cell = container.querySelector(`[data-gantt-date="${wednesdayKey}"]`);
		expect(cell?.querySelector(`[data-testid="gantt-daily-total-${wednesdayKey}"]`)?.textContent).toBe('1.5h');
		expect(cell?.querySelector('[data-testid="capacity-bar"]')).not.toBeNull();
	});

	it('絞り込み済みの items（1プロジェクト分）だけが合計に含まれる', () => {
		const items = [
			makeItem('a1', 'A-1', { projectId: 'p1', prep_date: Math.floor(wednesday.getTime() / 1000), estimatedMinutes: 60 }),
			makeItem('a2', 'A-2', { projectId: 'p1', prep_date: Math.floor(wednesday.getTime() / 1000), estimatedMinutes: 60 }),
		];

		const { container } = renderWithProviders(
			<RyokanGanttView {...defaultProps} showGroups={true} projects={projects} focusedProjectId="p1" items={items} />
		);

		const cell = container.querySelector(`[data-gantt-date="${wednesdayKey}"]`);
		expect(cell?.querySelector(`[data-testid="gantt-daily-total-${wednesdayKey}"]`)?.textContent).toBe('2h');
	});
});

/**
 * R-148: 日付ヘッダーの合計時間・CapacityBar に母集団ラベル（title）を付ける。
 * 列: 「全体の割当合計」／案件絞り込み中「案件の割当合計」。バー: 「タスクのみ／完了込|未完了のみ／全体枠|会社枠」
 */
describe('R-148: ガント日付ヘッダーの母集団ラベル（title）', () => {
	const items = [
		makeItem('task-90', '90分タスク', {
			prep_date: Math.floor(wednesday.getTime() / 1000),
			estimatedMinutes: 90,
		}),
	];

	it('案件絞り込みなしは列 title が「全体の割当合計」', () => {
		const { container } = renderWithProviders(<RyokanGanttView {...defaultProps} items={items} />);
		const cell = container.querySelector(`[data-gantt-date="${wednesdayKey}"]`) as HTMLElement;
		expect(cell.getAttribute('title')).toBe('全体の割当合計');
	});

	it('案件絞り込み中は列 title が「案件の割当合計」', () => {
		const { container } = renderWithProviders(<RyokanGanttView {...defaultProps} items={items} focusedProjectId="p1" />);
		const cell = container.querySelector(`[data-gantt-date="${wednesdayKey}"]`) as HTMLElement;
		expect(cell.getAttribute('title')).toBe('案件の割当合計');
	});

	it('CapacityBar の title は「タスクのみ／完了込／全体枠」（既定）', () => {
		const { container } = renderWithProviders(<RyokanGanttView {...defaultProps} items={items} />);
		const bar = container.querySelector(`[data-gantt-date="${wednesdayKey}"] [data-testid="capacity-bar"]`) as HTMLElement;
		expect(bar.getAttribute('title')).toBe('タスクのみ／完了込／全体枠');
	});

	it('includesCompleted=false・focusedTenantId ありは「タスクのみ／未完了のみ／会社枠」', () => {
		const { container } = renderWithProviders(
			<RyokanGanttView {...defaultProps} items={items} includesCompleted={false} focusedTenantId="t1" />
		);
		const bar = container.querySelector(`[data-gantt-date="${wednesdayKey}"] [data-testid="capacity-bar"]`) as HTMLElement;
		expect(bar.getAttribute('title')).toBe('タスクのみ／未完了のみ／会社枠');
	});

	it('列の Tailwind クラス（幅・高さ・折返し）は変わらない', () => {
		const { container } = renderWithProviders(<RyokanGanttView {...defaultProps} items={items} />);
		const cell = container.querySelector(`[data-gantt-date="${wednesdayKey}"]`) as HTMLElement;
		expect(cell.className).toContain('flex-none flex flex-col items-center justify-end pb-2');
		const total = cell.querySelector(`[data-testid="gantt-daily-total-${wednesdayKey}"]`) as HTMLElement;
		expect(total.className).toContain('text-[8px] leading-none mt-0.5');
		expect(total.textContent).toBe('1.5h');
	});
});
