import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { OverviewBoard } from '../OverviewBoard';
import type { OverviewItemWrapper } from '../useOverviewItems';

// モジュールレベルでモック
vi.mock('../../Inputs/QuickInputWidget', () => ({
    QuickInputWidget: ({ placeholder }: any) => (
        <input data-testid="quick-input" placeholder={placeholder} />
    )
}));

vi.mock('../../../hooks/useItemContextMenu', () => ({
    useItemContextMenu: () => ({
        menuState: null,
        handleContextMenu: vi.fn(),
        closeMenu: vi.fn()
    })
}));

vi.mock('../../../contexts/FilterContext', () => ({
    useFilter: () => ({ filterMode: 'all', setFilterMode: vi.fn(), hideCompleted: false, setHideCompleted: vi.fn() })
}));

vi.mock('../../../../auth/providers/AuthProvider', () => ({
    useAuth: () => ({ joinedTenants: [] })
}));

// useOverviewItems をモックして外部から制御できるようにする
let mockItems: OverviewItemWrapper[] = [];
vi.mock('../useOverviewItems', () => ({
    useOverviewItems: () => mockItems
}));

const makeProject = (id: string) => ({
    id,
    title: `Project ${id}`,
    isProject: true,
    type: 'project',
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
    tenantId: 'tenant-1',
});

const makeItemWrapper = (id: string, projectId: string, depth = 1): OverviewItemWrapper => ({
    id,
    type: 'item',
    item: {
        id,
        title: `Item ${id}`,
        status: 'inbox',
        focusOrder: 0,
        isEngaged: false,
        statusUpdatedAt: 0,
        interrupt: false,
        weight: 2,
        parentId: null,
        projectId,
        createdAt: 1000,
        updatedAt: 0,
        memo: '',
        due_date: '',
        flags: {},
    },
    project: makeProject(projectId) as any,
    depth,
});

const makeHeaderWrapper = (projectId: string, depth = 0): OverviewItemWrapper => ({
    id: `header-${projectId}`,
    type: 'header',
    projectId,
    projectTitle: `Project ${projectId}`,
    project: makeProject(projectId) as any,
    depth,
});

const makeDeadlineItemWrapper = (id: string, projectId: string): OverviewItemWrapper => ({
    id,
    type: 'item',
    item: {
        id,
        title: `Deadline Item ${id}`,
        status: 'inbox',
        focusOrder: 0,
        isEngaged: false,
        statusUpdatedAt: 0,
        interrupt: false,
        weight: 2,
        parentId: null,
        projectId,
        createdAt: 500,
        updatedAt: 0,
        memo: '',
        due_date: '2026-12-31',
        flags: {},
    },
    project: makeProject(projectId) as any,
    depth: 1,
});

const createMockViewModel = (throwIn = vi.fn()) => ({
    gdbActive: [],
    gdbPreparation: [],
    gdbIntent: [],
    gdbLog: [],
    allProjects: [],
    joinedTenants: [],
    deleteItem: vi.fn(),
    throwIn,
    todayCandidates: [],
    todayCommits: [],
});

describe('OverviewBoard インライン入力', () => {
    beforeEach(() => {
        mockItems = [];
    });

    it('＋ボタンをクリックするとインライン入力欄が表示される', () => {
        mockItems = [
            makeHeaderWrapper('proj-1'),
            makeItemWrapper('item-1', 'proj-1'),
            makeItemWrapper('item-2', 'proj-1'),
            makeDeadlineItemWrapper('item-3', 'proj-1'),
        ];

        const { container } = render(
            <OverviewBoard
                viewModel={createMockViewModel()}
                onOpenItem={vi.fn()}
            />
        );

        const addButton = container.querySelector('[title="サブアイテムを追加"]') as HTMLButtonElement;
        expect(addButton).toBeTruthy();
        fireEvent.click(addButton);

        // QuickInputWidget のプレースホルダーと同じなので複数あるうちに入力欄が増えることを確認
        const allInputs = container.querySelectorAll('input[placeholder="Alt+D to add..."]');
        expect(allInputs.length).toBeGreaterThanOrEqual(1);
    });

    it('Enter キーで throwIn が呼ばれ入力欄が消える', () => {
        const throwIn = vi.fn();
        mockItems = [
            makeHeaderWrapper('proj-1'),
            makeItemWrapper('item-1', 'proj-1'),
        ];

        const { container } = render(
            <OverviewBoard
                viewModel={createMockViewModel(throwIn)}
                onOpenItem={vi.fn()}
            />
        );

        const addButton = container.querySelector('[title="サブアイテムを追加"]') as HTMLButtonElement;
        fireEvent.click(addButton);

        // InlineAddRow の input（QuickInputWidgetのinputと区別するためデータ属性で特定）
        const inputs = container.querySelectorAll('input[placeholder="Alt+D to add..."]');
        // QuickInputWidget(data-testid="quick-input") 以外の最後の入力欄がInlineAddRow
        const inlineInput = Array.from(inputs).find(i => i.getAttribute('data-testid') !== 'quick-input') as HTMLInputElement;
        expect(inlineInput).toBeTruthy();

        fireEvent.change(inlineInput, { target: { value: '新しいタスク' } });
        fireEvent.keyDown(inlineInput, { key: 'Enter' });

        expect(throwIn).toHaveBeenCalledWith('新しいタスク', 'tenant-1', 'proj-1');
    });

    it('Escape キーで入力欄が消える', () => {
        mockItems = [
            makeHeaderWrapper('proj-1'),
            makeItemWrapper('item-1', 'proj-1'),
        ];

        const { container } = render(
            <OverviewBoard
                viewModel={createMockViewModel()}
                onOpenItem={vi.fn()}
            />
        );

        const addButton = container.querySelector('[title="サブアイテムを追加"]') as HTMLButtonElement;
        fireEvent.click(addButton);

        const inputs = container.querySelectorAll('input[placeholder="Alt+D to add..."]');
        const inlineInput = Array.from(inputs).find(i => i.getAttribute('data-testid') !== 'quick-input') as HTMLInputElement;
        expect(inlineInput).toBeTruthy();
        fireEvent.keyDown(inlineInput, { key: 'Escape' });

        const inputsAfter = Array.from(
            container.querySelectorAll('input[placeholder="Alt+D to add..."]')
        ).filter(i => i.getAttribute('data-testid') !== 'quick-input');
        expect(inputsAfter.length).toBe(0);
    });
});
