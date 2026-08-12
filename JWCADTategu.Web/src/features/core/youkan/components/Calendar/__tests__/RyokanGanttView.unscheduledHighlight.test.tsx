import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { RyokanGanttView } from '../RyokanGanttView';
import { Item } from '../../../types';
import { ToastProvider } from '../../../../../../contexts/ToastContext';

const renderWithProviders = (ui: React.ReactElement) =>
	render(<ToastProvider>{ui}</ToastProvider>);

/**
 * R-081: ガント一覧モード（showGroups=false）で日付未配置（prep_date/due_dateとも未設定）の
 * タスク名行に強調用の背景色クラスが付与されることを検証する
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

const defaultProps = {
	allDays: makeAllDays(),
	heatMap: new Map(),
	today: new Date(2026, 2, 15),
	safeConfig: {},
	rowHeight: 40,
	renderItemTitle: (item: Item) => item.title,
	showGroups: false,
	projects: [],
};

describe('R-081: ガント日付未配置タスクの視覚的強調', () => {
	it('prep_date・due_dateともに未設定のアイテムはタスク名セルに強調クラスが付く', () => {
		const items = [makeItem('task-unscheduled', '未配置タスク', { due_date: null, prep_date: null })];

		renderWithProviders(<RyokanGanttView {...defaultProps} items={items} />);

		const cell = screen.getByTestId('gantt-title-cell-task-unscheduled');
		expect(cell.className).toMatch(/bg-amber-50/);
	});

	it('due_dateが設定済みのアイテムには強調クラスが付かない', () => {
		const items = [makeItem('task-due', '納期ありタスク', { due_date: '2026-03-20', prep_date: null })];

		renderWithProviders(<RyokanGanttView {...defaultProps} items={items} />);

		const cell = screen.getByTestId('gantt-title-cell-task-due');
		expect(cell.className).not.toMatch(/bg-amber-50/);
	});

	it('prep_dateのみ設定済みのアイテムには強調クラスが付かない', () => {
		const items = [makeItem('task-prep', 'マイ期限ありタスク', { due_date: null, prep_date: Math.floor(new Date(2026, 2, 10).getTime() / 1000) })];

		renderWithProviders(<RyokanGanttView {...defaultProps} items={items} />);

		const cell = screen.getByTestId('gantt-title-cell-task-prep');
		expect(cell.className).not.toMatch(/bg-amber-50/);
	});
});
