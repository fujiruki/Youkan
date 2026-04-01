import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NewspaperBoard } from '../NewspaperBoard';

// QuickInputWidgetのモック
vi.mock('../../Inputs/QuickInputWidget', () => ({
    QuickInputWidget: ({ placeholder }: any) => (
        <input data-testid="quick-input" placeholder={placeholder} />
    )
}));

// useNewspaperItemsのモック
vi.mock('../useNewspaperItems', () => ({
    useNewspaperItems: () => []
}));

// useItemContextMenuのモック
vi.mock('../../../hooks/useItemContextMenu', () => ({
    useItemContextMenu: () => ({
        menuState: null,
        handleContextMenu: vi.fn(),
        closeMenu: vi.fn()
    })
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

describe('NewspaperBoard 列幅', () => {
    it('columnWidthはfontSize * 15pxであること', () => {
        const { container } = render(
            <NewspaperBoard
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
        localStorage.setItem('youkan_newspaper_columns', '4');
        const { container } = render(
            <NewspaperBoard
                viewModel={mockViewModel}
                onOpenItem={vi.fn()}
            />
        );
        const columnDiv = container.querySelector('[style*="column-count"]') as HTMLElement;
        expect(columnDiv.style.columnCount).toBe('4');
        localStorage.removeItem('youkan_newspaper_columns');
    });
});
