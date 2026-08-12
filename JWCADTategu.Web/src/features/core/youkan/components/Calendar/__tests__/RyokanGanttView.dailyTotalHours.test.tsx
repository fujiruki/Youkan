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
