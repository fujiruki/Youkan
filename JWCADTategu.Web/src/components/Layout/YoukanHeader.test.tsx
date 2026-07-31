import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { YoukanHeader } from './YoukanHeader';
import { FilterProvider } from '../../features/core/youkan/contexts/FilterContext';
import { ViewModeProvider } from '../../features/core/youkan/contexts/ViewModeContext';

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
vi.mock('../../features/core/youkan/components/ForAi/ForAiModal', () => ({
    ForAiModal: () => null
}));
vi.mock('../../features/core/youkan/components/ImprovementRequest/ImprovementRequestModal', () => ({
    ImprovementRequestModal: ({ isOpen }: { isOpen: boolean }) =>
        isOpen ? <div data-testid="improvement-request-modal" /> : null
}));
vi.mock('../../features/core/youkan/components/Speech/SpeechView', () => ({
    SpeechView: () => null
}));
vi.mock('../../features/core/youkan/components/Speech/SpeechButton', () => ({
    SpeechButton: () => null
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
        <ViewModeProvider>
            <FilterProvider>
                <YoukanHeader {...defaultProps} {...props} />
            </FilterProvider>
        </ViewModeProvider>
    );

describe('YoukanHeader View名', () => {
    it('ダッシュボードセクションに「状況把握」タブが表示される', () => {
        renderHeader();
        expect(screen.getByText('状況把握')).toBeInTheDocument();
    });

    it('ダッシュボードセクションに「全体一覧」タブが表示される', () => {
        renderHeader();
        expect(screen.getByText('全体一覧')).toBeInTheDocument();
    });
});

describe('YoukanHeader R-071 改善要望送信フォーム', () => {
    it('「改善要望を送る」ボタンがPC向けヘッダーに表示される', () => {
        renderHeader();
        expect(screen.getByTitle('改善要望を送る')).toBeInTheDocument();
    });

    it('ロゴの文字サイズが50%（text-[7px]）に縮小されている', () => {
        renderHeader();
        const logoText = screen.getByText('Youkan');
        expect(logoText.className).toContain('text-[7px]');
    });

    it('「改善要望を送る」ボタン押下でモーダルが開く', () => {
        renderHeader();
        expect(screen.queryByTestId('improvement-request-modal')).toBeNull();
        fireEvent.click(screen.getByTitle('改善要望を送る'));
        expect(screen.getByTestId('improvement-request-modal')).toBeInTheDocument();
    });
});

describe('YoukanHeader CustomEvent', () => {
    it('「状況把握」クリックで youkan-view-mode-change イベントが発火し detail.mode === "panorama"', () => {
        renderHeader();
        let capturedMode: unknown = undefined;
        const handler = (e: Event) => {
            capturedMode = (e as CustomEvent).detail?.mode;
        };
        window.addEventListener('youkan-view-mode-change', handler);
        fireEvent.click(screen.getByText('状況把握'));
        window.removeEventListener('youkan-view-mode-change', handler);
        expect(capturedMode).toBe('panorama');
    });

    it('「全体一覧」クリックで youkan-view-mode-change イベントが発火し detail.mode === "overview"', () => {
        renderHeader();
        let capturedMode: unknown = undefined;
        const handler = (e: Event) => {
            capturedMode = (e as CustomEvent).detail?.mode;
        };
        window.addEventListener('youkan-view-mode-change', handler);
        fireEvent.click(screen.getByText('全体一覧'));
        window.removeEventListener('youkan-view-mode-change', handler);
        expect(capturedMode).toBe('overview');
    });
});
