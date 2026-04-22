import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { DashboardScreen } from '../DashboardScreen';
import { FilterProvider } from '../../contexts/FilterContext';
import { ViewModeProvider, useViewMode } from '../../contexts/ViewModeContext';

// 重量コンポーネントをスタブ化
vi.mock('../../viewmodels/useYoukanViewModel', () => ({
    useYoukanViewModel: () => ({
        gdbActive: [],
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
        refreshAll: vi.fn(),
        refreshGdb: vi.fn(),
        updateItem: vi.fn(),
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

vi.mock('../../components/PanoramaBoard/PanoramaBoard', () => ({
    PanoramaBoard: () => <div data-testid="panorama-layout" />,
}));

vi.mock('../../components/OverviewBoard/OverviewBoard', () => ({
    OverviewBoard: () => <div data-testid="overview-layout" />,
}));

vi.mock('../../components/Calendar/RyokanCalendar', () => ({
    RyokanCalendar: () => <div data-testid="calendar-layout" />,
}));

vi.mock('../../components/Calendar/GanttHeader', () => ({
    GanttHeader: () => <div data-testid="gantt-header" />,
}));

vi.mock('../../components/Dashboard/SmartItemRow', () => ({
    SmartItemRow: () => null,
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

vi.mock('../../components/Modal/DecisionDetailModal', () => ({
    DecisionDetailModal: () => null,
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

// ViewModeを外部から操作するためのヘルパーコンポーネント
const ViewModeSwitcher = ({ mode }: { mode: string }) => {
    const { setDashboardViewMode } = useViewMode();
    return (
        <button data-testid="switch-mode" onClick={() => setDashboardViewMode(mode as any)}>switch</button>
    );
};

const renderDashboard = (extraChildren?: React.ReactNode) =>
    render(
        <ViewModeProvider>
            <FilterProvider>
                <DashboardScreen />
                {extraChildren}
            </FilterProvider>
        </ViewModeProvider>
    );

beforeEach(() => {
    localStorage.clear();
});

describe('DashboardScreen viewMode 切替', () => {
    it('初期状態（stream モード）では data-testid="stream-layout" が表示される', () => {
        localStorage.setItem('youkan_view_mode', 'stream');
        renderDashboard();
        expect(screen.getByTestId('stream-layout')).toBeInTheDocument();
    });

    it('panorama モード時に data-testid="panorama-layout" が出現する', async () => {
        localStorage.setItem('youkan_view_mode', 'stream');
        renderDashboard(<ViewModeSwitcher mode="panorama" />);
        await act(async () => {
            screen.getByTestId('switch-mode').click();
        });
        expect(screen.getByTestId('panorama-layout')).toBeInTheDocument();
    });

    it('overview モード時に data-testid="overview-layout" が出現する', async () => {
        localStorage.setItem('youkan_view_mode', 'stream');
        renderDashboard(<ViewModeSwitcher mode="overview" />);
        await act(async () => {
            screen.getByTestId('switch-mode').click();
        });
        expect(screen.getByTestId('overview-layout')).toBeInTheDocument();
    });

    it('panorama モード時には stream-layout は表示されない', async () => {
        localStorage.setItem('youkan_view_mode', 'stream');
        renderDashboard(<ViewModeSwitcher mode="panorama" />);
        await act(async () => {
            screen.getByTestId('switch-mode').click();
        });
        expect(screen.queryByTestId('stream-layout')).not.toBeInTheDocument();
    });

    it('stream モード時には panorama-layout・overview-layout は表示されない', () => {
        localStorage.setItem('youkan_view_mode', 'stream');
        renderDashboard();
        expect(screen.queryByTestId('panorama-layout')).not.toBeInTheDocument();
        expect(screen.queryByTestId('overview-layout')).not.toBeInTheDocument();
    });
});
