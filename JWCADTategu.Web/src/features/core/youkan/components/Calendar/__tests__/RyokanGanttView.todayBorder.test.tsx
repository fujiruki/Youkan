import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';
import { RyokanGanttView } from '../RyokanGanttView';
import { Item } from '../../../types';
import { ToastProvider } from '../../../../../../contexts/ToastContext';

/**
 * R-0163: 本日列の枠線を濃い黄色にし、ヘッダー・背景グリッド・アイテム行セルで同一クラスを共有する
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

describe('R-0163: ガント本日列の枠線', () => {
	it('本日の全セル（ヘッダー・背景・アイテム行）に不透明な amber-500 の左右枠線が付き、他の日には付かない', () => {
		const { container } = render(
			<ToastProvider>
				<RyokanGanttView
					allDays={makeAllDays()}
					heatMap={new Map()}
					today={new Date(2026, 2, 15)}
					safeConfig={{}}
					rowHeight={40}
					renderItemTitle={(item: Item) => item.title}
					items={[makeItem('task-1', 'タスク'), makeItem('task-2', 'タスク2')]}
					projects={[]}
					showGroups={false}
				/>
			</ToastProvider>
		);
		const today = Array.from(container.querySelectorAll('[data-gantt-date="Sun Mar 15 2026"]'));
		expect(today.length).toBeGreaterThanOrEqual(4);
		for (const el of today) {
			expect(el.className).toContain('border-l-amber-500');
			expect(el.className).toContain('border-r-amber-500');
			expect(el.className).not.toContain('amber-300');
		}
		for (const el of Array.from(container.querySelectorAll('[data-gantt-date="Mon Mar 16 2026"]'))) {
			expect(el.className).not.toContain('border-l-amber-500');
		}
	});
});
