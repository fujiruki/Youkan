import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { OverviewBoard } from '../OverviewBoard';

// QuickInputWidgetのモック
vi.mock('../../Inputs/QuickInputWidget', () => ({
	QuickInputWidget: ({ placeholder }: any) => (
		<input data-testid="quick-input" placeholder={placeholder} />
	)
}));

// useOverviewItemsのモック
vi.mock('../useOverviewItems', () => ({
	useOverviewItems: () => []
}));

// useItemContextMenuのモック
vi.mock('../../../hooks/useItemContextMenu', () => ({
	useItemContextMenu: () => ({
		menuState: null,
		handleContextMenu: vi.fn(),
		closeMenu: vi.fn()
	})
}));

// FilterContextのモック
vi.mock('../../../contexts/FilterContext', () => ({
	useFilter: () => ({ filterMode: 'all', setFilterMode: vi.fn(), hideCompleted: false, setHideCompleted: vi.fn() })
}));

// AuthProviderのモック
vi.mock('../../../../auth/providers/AuthProvider', () => ({
	useAuth: () => ({ joinedTenants: [] })
}));

const mockViewModel = {
	gdbActive: [],
	gdbPreparation: [],
	gdbIntent: [],
	gdbLog: [],
	allProjects: [],
	joinedTenants: [],
	deleteItem: vi.fn(),
	throwIn: vi.fn(),
	todayCandidates: [],
	todayCommits: [],
};

describe('OverviewBoard 印刷ボタン（R-098）', () => {
	it('印刷ボタンが表示され、クリックで window.print が呼ばれる', () => {
		const printSpy = vi.spyOn(window, 'print').mockImplementation(() => { });
		render(
			<OverviewBoard
				viewModel={mockViewModel}
				onOpenItem={vi.fn()}
			/>
		);
		fireEvent.click(screen.getByTitle('印刷'));
		expect(printSpy).toHaveBeenCalledTimes(1);
		printSpy.mockRestore();
	});
});
