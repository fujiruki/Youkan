import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
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

describe('OverviewBoard 列幅', () => {
    it('columnWidthはfontSize * 15pxであること', () => {
        const { container } = render(
            <OverviewBoard
                viewModel={mockViewModel}
                onOpenItem={vi.fn()}
            />
        );
        // デフォルトfontSize=11, columnWidth = 11 * 15 = 165px
        const columnDiv = container.querySelector('[style*="column-count"]') as HTMLElement;
        expect(columnDiv).toBeTruthy();
        expect(columnDiv.style.columnWidth).toBe('165px');
    });

    it('列数4でcolumnCountが正しく適用されること', () => {
        // localStorageにcolumnCount=4を設定
        localStorage.setItem('youkan_overview_columns', '4');
        const { container } = render(
            <OverviewBoard
                viewModel={mockViewModel}
                onOpenItem={vi.fn()}
            />
        );
        const columnDiv = container.querySelector('[style*="column-count"]') as HTMLElement;
        expect(columnDiv.style.columnCount).toBe('4');
        localStorage.removeItem('youkan_overview_columns');
    });
});
