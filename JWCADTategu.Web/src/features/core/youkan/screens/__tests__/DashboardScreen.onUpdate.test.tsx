import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import { FilterProvider } from '../../contexts/FilterContext';
import { ViewModeProvider } from '../../contexts/ViewModeContext';
import { Item } from '../../types';

const mockRefreshAll = vi.fn();
const mockUpdateItem = vi.fn().mockResolvedValue(undefined);

const mockItem: Item = {
    id: 'test-item-1',
    title: 'テストアイテム',
    status: 'inbox',
    isProject: false,
};

vi.mock('../../viewmodels/useYoukanViewModel', () => ({
    useYoukanViewModel: () => ({
        gdbActive: [mockItem],
        gdbPreparation: [],
        gdbIntent: [],
        gdbLog: [],
        ghostGdbCount: 0,
        ghostTodayCount: 0,
        todayCandidates: [],
        todayCommits: [],
        capacityUsed: 0,
        capacityLimit: 100,
        filterMode: 'all',
        executionItem: null,
        allProjects: [],
        members: [],
        joinedTenants: [],
        capacityConfig: null,
        currentUserId: null,
        memos: [],
        error: null,
        refreshAll: mockRefreshAll,
        refreshGdb: vi.fn(),
        updateItem: mockUpdateItem,
        deleteItem: vi.fn(),
        completeItem: vi.fn(),
        createSubTask: vi.fn(),
        getSubTasks: vi.fn(),
        skipTask: vi.fn(),
        setEngaged: vi.fn(),
        resolveDecision: vi.fn(),
        createProject: vi.fn(),
        moveToSomeday: vi.fn(),
        delegateTask: vi.fn(),
        projectizeItem: vi.fn(),
        addSideMemo: vi.fn(),
        deleteSideMemo: vi.fn(),
        memoToInbox: vi.fn(),
        throwIn: vi.fn(),
        archiveItem: vi.fn(),
        clearError: vi.fn(),
        updatePreparationDate: vi.fn(),
        updateItemMetrics: vi.fn(),
    }),
}));

// onUpdate をキャプチャするためのスパイ
let capturedOnUpdate: ((id: string, updates: Partial<Item>) => Promise<void>) | undefined;

vi.mock('../../components/Modal/DecisionDetailModal', () => ({
    DecisionDetailModal: (props: {
        item?: Item | null;
        onUpdate?: (id: string, updates: Partial<Item>) => Promise<void>;
    }) => {
        capturedOnUpdate = props.onUpdate;
        return props.item ? <div data-testid="detail-modal" /> : null;
    },
}));

// SmartItemRow: onClick を呼び出すボタンをレンダリング
vi.mock('../../components/Dashboard/SmartItemRow', () => ({
    SmartItemRow: (props: { item: Item; onClick?: () => void }) => (
        <button data-testid={`item-row-${props.item.id}`} onClick={props.onClick}>
            {props.item.title}
        </button>
    ),
}));

vi.mock('../../components/PanoramaBoard/PanoramaBoard', () => ({
    PanoramaBoard: () => <div data-testid="panorama-layout" />,
}));

vi.mock('../../components/OverviewBoard/OverviewBoard', () => ({
    OverviewBoard: () => <div data-testid="overview-layout" />,
}));

vi.mock('../../components/Calendar/RyokanCalendar', () => ({
    RyokanCalendar: () => <div data-testid="calendar-layout" />,
}));

vi.mock('../../components/Calendar/CalendarHeader', () => ({
    CalendarHeader: () => <div data-testid="calendar-header" />,
}));

vi.mock('../../components/Dashboard/SortableFocusQueue', () => ({
    SortableFocusQueue: () => null,
}));

vi.mock('../../components/Dashboard/FocusCard', () => ({
    FocusCard: () => null,
}));

vi.mock('../../components/Inputs/QuickInputWidget', () => ({
    QuickInputWidget: () => null,
}));

vi.mock('../../components/PanoramaBoard/ContextMenu', () => ({
    ContextMenu: () => null,
}));

vi.mock('../../hooks/useItemContextMenu', () => ({
    useItemContextMenu: () => ({
        menuState: null,
        handleContextMenu: vi.fn(),
        closeMenu: vi.fn(),
        lastTargetId: null,
        setLastTargetId: vi.fn(),
    }),
}));

vi.mock('../../hooks/buildItemContextMenuActions', () => ({
    buildItemContextMenuActions: () => [],
}));

vi.mock('../../components/SideMemo/SideMemoWidget', () => ({
    SideMemoWidget: () => null,
}));

vi.mock('../../../../../api/client', () => ({
    ApiClient: {
        request: vi.fn(),
    },
}));

vi.mock('../../../../../db/db', () => ({
    db: {},
}));

import { DashboardScreen } from '../DashboardScreen';

const renderDashboard = () =>
    render(
        <ViewModeProvider>
            <FilterProvider>
                <DashboardScreen />
            </FilterProvider>
        </ViewModeProvider>
    );

beforeEach(() => {
    localStorage.setItem('youkan_view_mode', 'stream');
    vi.clearAllMocks();
    capturedOnUpdate = undefined;
});

describe('DashboardScreen DecisionDetailModal onUpdate', () => {
    it('onUpdate 実行時に refreshAll は呼ばれない', async () => {
        renderDashboard();

        // アイテム行をクリックして selectedItem をセットし、DecisionDetailModal を表示させる
        await act(async () => {
            fireEvent.click(screen.getByTestId('item-row-test-item-1'));
        });

        expect(screen.getByTestId('detail-modal')).toBeInTheDocument();
        expect(capturedOnUpdate).toBeDefined();

        await act(async () => {
            await capturedOnUpdate!('test-item-1', { title: '変更後タイトル' });
        });

        expect(mockUpdateItem).toHaveBeenCalledWith('test-item-1', { title: '変更後タイトル' });
        expect(mockRefreshAll).not.toHaveBeenCalled();
    });

    it('onUpdate 実行時に updateItem が正しい引数で呼ばれる', async () => {
        renderDashboard();

        await act(async () => {
            fireEvent.click(screen.getByTestId('item-row-test-item-1'));
        });

        expect(capturedOnUpdate).toBeDefined();

        const updates: Partial<Item> = { status: 'someday', title: 'テスト' };
        await act(async () => {
            await capturedOnUpdate!('test-item-1', updates);
        });

        expect(mockUpdateItem).toHaveBeenCalledTimes(1);
        expect(mockUpdateItem).toHaveBeenCalledWith('test-item-1', updates);
    });
});
