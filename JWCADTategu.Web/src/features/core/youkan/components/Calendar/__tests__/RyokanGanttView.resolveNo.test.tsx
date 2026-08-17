import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

beforeEach(() => {
	vi.clearAllMocks();
	mockGetDependencies.mockResolvedValue([]);
});

// R-124: 右クリックメニューの「断る」がstatus:'done'（完了）を直接書き込んでいた旧バグの回帰テスト。
// decision解決の共通ロジック（decisionToStatus）を経由し、status:'cancelled'を書き込むようにする。
describe('RyokanGanttView: 右クリックメニューの「断る」（R-124）', () => {
	it('「断る」を押すとstatus:cancelledで更新される（旧バグ: status:doneにはならない）', async () => {
		const items = [makeItem('task-1', 'タスク1')];
		const mockUpdateItem = vi.fn().mockResolvedValue(undefined);

		const { container } = renderWithProviders(
			<RyokanGanttView {...defaultProps} items={items} onUpdateItem={mockUpdateItem} />
		);

		const titleCell = container.querySelector('[data-testid="gantt-title-cell-task-1"]');
		expect(titleCell).toBeTruthy();

		fireEvent.contextMenu(titleCell!);

		const rejectButton = await screen.findByText(/断/);
		const user = userEvent.setup();
		await user.click(rejectButton);

		await waitFor(() => expect(mockUpdateItem).toHaveBeenCalledWith('task-1', { status: 'cancelled' }));
	});
});
