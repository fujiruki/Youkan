import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { RyokanGanttView } from '../RyokanGanttView';
import { Item } from '../../../types';
import { ToastProvider } from '../../../../../../contexts/ToastContext';

/**
 * R-150: ガント行ホバー時に見出し列と時間軸の両方へ同じ強調（背景＋下線 box-shadow）が付くこと
 */

const makeAllDays = (): Date[] => {
	const days: Date[] = [];
	for (let d = 1; d <= 31; d++) days.push(new Date(2026, 2, d));
	return days;
};

const makeItem = (id: string, title: string): Item => ({
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
	due_date: '2026-03-10',
	flags: {},
});

const HOVER_SHADOW = 'inset_0_-2px_0_0_rgb(203_213_225)';

describe('R-150: ガント行ホバー強調', () => {
	it('行 div に背景一段濃く＋下線 box-shadow の hover クラスが付き、border 幅クラスは変わらない', () => {
		render(
			<ToastProvider>
				<RyokanGanttView
					allDays={makeAllDays()}
					heatMap={new Map()}
					today={new Date(2026, 2, 15)}
					safeConfig={{}}
					rowHeight={40}
					renderItemTitle={(item: Item) => item.title}
					items={[makeItem('task-1', 'タスク')]}
					projects={[]}
					showGroups={false}
				/>
			</ToastProvider>
		);
		const cell = screen.getByTestId('gantt-title-cell-task-1');
		const row = cell.parentElement!;
		expect(row.className).toContain('hover:bg-slate-100');
		expect(row.className).toContain(`hover:shadow-[${HOVER_SHADOW}]`);
		expect(row.className).toContain('border-b ');
		expect(row.className).not.toMatch(/hover:border-b-\d/);
		expect(cell.className).toContain('group-hover:bg-slate-100');
		expect(cell.className).toMatch(new RegExp(`group-hover:shadow-\\[[^\\]]*${HOVER_SHADOW.replace(/[()]/g, '\\$&')}\\]`));
	});
});
