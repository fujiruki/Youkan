import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';
import { RyokanGanttView } from '../RyokanGanttView';
import { ToastProvider } from '../../../../../../contexts/ToastContext';

/**
 * R-097: ガントビューの列幅（colWidth）・行高さ（rowHeight）プロパティ化のテスト
 *
 * マンスリーの初期値は既存動作（列幅24px固定相当・行高さ28px相当）を完全維持する必要があるため、
 * プロパティ省略時のデフォルト値を検証する。
 */

const renderWithProviders = (ui: React.ReactElement) =>
	render(<ToastProvider>{ui}</ToastProvider>);

const makeAllDays = (count: number): Date[] => {
	const days: Date[] = [];
	for (let d = 1; d <= count; d++) {
		days.push(new Date(2026, 2, d));
	}
	return days;
};

const baseProps = {
	items: [],
	heatMap: new Map(),
	today: new Date(2026, 2, 15),
	safeConfig: {},
	rowHeight: 28,
	projects: [],
	renderItemTitle: () => '',
	showGroups: false,
};

describe('RyokanGanttView 列幅・行高さのプロパティ化（R-097）', () => {
	it('colWidth未指定時、日付列の幅は既存動作維持のため24pxになる', () => {
		const allDays = makeAllDays(5);
		const { container } = renderWithProviders(
			<RyokanGanttView allDays={allDays} {...baseProps} />
		);
		const dateCell = container.querySelector('[data-gantt-date]') as HTMLElement;
		expect(dateCell).not.toBeNull();
		expect(dateCell.style.width).toBe('24px');
	});

	it('colWidthを指定すると、日付列の幅が反映される', () => {
		const allDays = makeAllDays(5);
		const { container } = renderWithProviders(
			<RyokanGanttView allDays={allDays} {...baseProps} colWidth={48} />
		);
		const dateCell = container.querySelector('[data-gantt-date]') as HTMLElement;
		expect(dateCell).not.toBeNull();
		expect(dateCell.style.width).toBe('48px');
	});

	it('rowHeightを指定すると、タスク行の高さが反映される', () => {
		const allDays = makeAllDays(5);
		const items = [
			{ id: 'item-1', title: 'テストタスク', status: 'pending' } as any,
		];
		const { container } = renderWithProviders(
			<RyokanGanttView allDays={allDays} {...baseProps} items={items} rowHeight={40} />
		);
		const row = container.querySelector('[data-item-id="item-1"]') as HTMLElement;
		expect(row).not.toBeNull();
		expect(row.style.height).toBe('40px');
	});
});
