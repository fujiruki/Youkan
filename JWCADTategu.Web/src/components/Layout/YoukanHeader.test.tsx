import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { YoukanHeader } from './YoukanHeader';
import { FilterProvider } from '../../features/core/youkan/contexts/FilterContext';

vi.mock('../../features/core/youkan/components/Layout/HealthCheck', () => ({
    HealthCheck: () => null
}));
vi.mock('./MenuDrawer', () => ({
    MenuDrawer: () => null
}));
vi.mock('../../features/core/youkan/components/Layout/MotivatorWhisper', () => ({
    MotivatorWhisper: () => null
}));
vi.mock('../../features/core/youkan/components/Dashboard/ViewContextBar', () => ({
    ViewContextBar: () => null
}));

const defaultProps = {
    currentView: 'dashboard' as const,
    onNavigateToToday: vi.fn(),
    onNavigateToDashboard: vi.fn(),
    onNavigateToHistory: vi.fn(),
    onNavigateToProjects: vi.fn(),
    onNavigateToSettings: vi.fn(),
};

const renderHeader = (props = {}) =>
    render(
        <FilterProvider>
            <YoukanHeader {...defaultProps} {...props} />
        </FilterProvider>
    );

describe('YoukanHeader View名', () => {
    it('ダッシュボードセクションに「状況把握」タブが表示される', () => {
        renderHeader();
        expect(screen.getByText('状況把握')).toBeInTheDocument();
    });

    it('ダッシュボードセクションに「全体一覧」タブが表示される（旧「全体一覧2」）', () => {
        renderHeader();
        expect(screen.getByText('全体一覧')).toBeInTheDocument();
    });

    it('旧名「全体一覧2」は表示されない', () => {
        renderHeader();
        expect(screen.queryByText('全体一覧2')).not.toBeInTheDocument();
    });
});
