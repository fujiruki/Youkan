import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';
import { RyokanGanttView } from '../RyokanGanttView';
import { Item, CapacityConfig } from '../../../types';
import { ToastProvider } from '../../../../../../contexts/ToastContext';

vi.mock('../../../repositories/DependencyRepository', () => ({
	DependencyRepository: vi.fn().mockImplementation(function (this: any) {
		this.getDependencies = vi.fn().mockResolvedValue([]);
		this.createDependency = vi.fn();
		this.deleteDependency = vi.fn();
	}),
}));

const days = Array.from({ length: 31 }, (_, i) => new Date(2026, 2, i + 1));
const capacityConfig: CapacityConfig = { defaultDailyMinutes: 480, holidays: [], exceptions: {} };
const wedUnix = Math.floor(new Date(2026, 2, 4).getTime() / 1000);

const make = (id: string, overrides: Partial<Item>): Item => ({
	id, title: id, status: 'focus', focusOrder: 0, isEngaged: false, statusUpdatedAt: 0, interrupt: false,
	weight: 2, parentId: null, projectId: null, createdAt: 0, updatedAt: 0, memo: '', due_date: '', flags: {},
	prep_date: wedUnix, estimatedMinutes: 90, ...overrides,
} as Item);

const renderGantt = (items: Item[]) => render(
	<ToastProvider>
		<RyokanGanttView
			allDays={days} items={items} heatMap={new Map()} today={new Date(2026, 2, 15)} safeConfig={{}}
			rowHeight={40} renderItemTitle={(i: Item) => i.title} showGroups={false} projects={[]}
			capacityConfig={capacityConfig} currentUserId="user1"
		/>
	</ToastProvider>
);

beforeEach(() => vi.clearAllMocks());

describe('R-0169: ガントで計算のみのタスクを非表示', () => {
	it('pending の請求は行が出ない', () => {
		const { container } = renderGantt([make('inv', { status: 'pending', generatedTaskRole: 'invoice' }), make('normal', {})]);
		expect(container.querySelector('[data-item-id="inv"]')).toBeNull();
		expect(container.querySelector('[data-item-id="normal"]')).toBeTruthy();
	});
	it('納品済み等で pending 以外の請求は行が出る', () => {
		const { container } = renderGantt([make('inv', { status: 'inbox', generatedTaskRole: 'invoice' })]);
		expect(container.querySelector('[data-item-id="inv"]')).toBeTruthy();
	});
});
