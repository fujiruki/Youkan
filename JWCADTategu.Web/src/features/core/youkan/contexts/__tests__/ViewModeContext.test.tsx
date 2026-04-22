import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { useViewMode, ViewModeProvider } from '../ViewModeContext';

beforeEach(() => {
    localStorage.clear();
});

const ViewModeDisplay = () => {
    const { dashboardViewMode, projectViewMode, calendarViewMode } = useViewMode();
    return (
        <>
            <div data-testid="dashboard-view-mode">{dashboardViewMode}</div>
            <div data-testid="project-view-mode">{projectViewMode}</div>
            <div data-testid="calendar-view-mode">{calendarViewMode}</div>
        </>
    );
};

const DashboardViewModeSetter = ({ mode }: { mode: string }) => {
    const { setDashboardViewMode } = useViewMode();
    return (
        <button data-testid="set-dashboard" onClick={() => setDashboardViewMode(mode as any)}>
            Set
        </button>
    );
};

const CalendarViewModeSetter = ({ mode }: { mode: string }) => {
    const { setCalendarViewMode } = useViewMode();
    return (
        <button data-testid="set-calendar" onClick={() => setCalendarViewMode(mode as any)}>
            Set
        </button>
    );
};

const ProjectViewModeSetter = ({ mode }: { mode: string }) => {
    const { setProjectViewMode } = useViewMode();
    return (
        <button data-testid="set-project" onClick={() => setProjectViewMode(mode as any)}>
            Set
        </button>
    );
};

const OutsideConsumer = () => {
    useViewMode();
    return null;
};

describe('ViewModeContext', () => {
    describe('ViewModeProvider 内で useViewMode を使う', () => {
        it('useViewMode が必要なフィールドをすべて返す', () => {
            const { getByTestId } = render(
                <ViewModeProvider>
                    <ViewModeDisplay />
                </ViewModeProvider>
            );
            expect(getByTestId('dashboard-view-mode')).toBeInTheDocument();
            expect(getByTestId('project-view-mode')).toBeInTheDocument();
            expect(getByTestId('calendar-view-mode')).toBeInTheDocument();
        });

        it('dashboardViewMode の初期値は localStorage youkan_view_mode から読む', () => {
            localStorage.setItem('youkan_view_mode', 'panorama');
            const { getByTestId } = render(
                <ViewModeProvider>
                    <ViewModeDisplay />
                </ViewModeProvider>
            );
            expect(getByTestId('dashboard-view-mode').textContent).toBe('panorama');
        });

        it('dashboardViewMode の初期値は localStorage 未設定時 "stream"', () => {
            const { getByTestId } = render(
                <ViewModeProvider>
                    <ViewModeDisplay />
                </ViewModeProvider>
            );
            expect(getByTestId('dashboard-view-mode').textContent).toBe('stream');
        });

        it('projectViewMode の初期値は youkan_project_view_mode から、なければ "grid"', () => {
            const { getByTestId } = render(
                <ViewModeProvider>
                    <ViewModeDisplay />
                </ViewModeProvider>
            );
            expect(getByTestId('project-view-mode').textContent).toBe('grid');
        });

        it('calendarViewMode の初期値は youkan_calendar_view_mode から、なければ "grid"', () => {
            const { getByTestId } = render(
                <ViewModeProvider>
                    <ViewModeDisplay />
                </ViewModeProvider>
            );
            expect(getByTestId('calendar-view-mode').textContent).toBe('grid');
        });

        it('calendarViewMode の初期値は localStorage youkan_calendar_view_mode から読む', () => {
            localStorage.setItem('youkan_calendar_view_mode', 'gantt');
            const { getByTestId } = render(
                <ViewModeProvider>
                    <ViewModeDisplay />
                </ViewModeProvider>
            );
            expect(getByTestId('calendar-view-mode').textContent).toBe('gantt');
        });

        it('setDashboardViewMode で値が更新され localStorage にも保存される', async () => {
            const { getByTestId } = render(
                <ViewModeProvider>
                    <ViewModeDisplay />
                    <DashboardViewModeSetter mode="panorama" />
                </ViewModeProvider>
            );
            await act(async () => {
                getByTestId('set-dashboard').click();
            });
            expect(getByTestId('dashboard-view-mode').textContent).toBe('panorama');
            expect(localStorage.getItem('youkan_view_mode')).toBe('panorama');
        });

        it('setDashboardViewMode を呼ぶと CustomEvent youkan-view-mode-change が発火し detail.mode が含まれる', async () => {
            const handler = vi.fn();
            window.addEventListener('youkan-view-mode-change', handler);
            const { getByTestId } = render(
                <ViewModeProvider>
                    <DashboardViewModeSetter mode="overview" />
                </ViewModeProvider>
            );
            await act(async () => {
                getByTestId('set-dashboard').click();
            });
            expect(handler).toHaveBeenCalled();
            const event = handler.mock.calls[0][0] as CustomEvent;
            expect(event.detail.mode).toBe('overview');
            window.removeEventListener('youkan-view-mode-change', handler);
        });

        it('setCalendarViewMode を呼ぶと youkan-calendar-view-mode-change イベントが発火する', async () => {
            const handler = vi.fn();
            window.addEventListener('youkan-calendar-view-mode-change', handler);
            const { getByTestId } = render(
                <ViewModeProvider>
                    <CalendarViewModeSetter mode="timeline" />
                </ViewModeProvider>
            );
            await act(async () => {
                getByTestId('set-calendar').click();
            });
            expect(handler).toHaveBeenCalled();
            const event = handler.mock.calls[0][0] as CustomEvent;
            expect(event.detail.mode).toBe('timeline');
            window.removeEventListener('youkan-calendar-view-mode-change', handler);
        });

        it('setProjectViewMode を呼ぶと youkan-project-view-mode-change イベントが発火する', async () => {
            const handler = vi.fn();
            window.addEventListener('youkan-project-view-mode-change', handler);
            const { getByTestId } = render(
                <ViewModeProvider>
                    <ProjectViewModeSetter mode="list" />
                </ViewModeProvider>
            );
            await act(async () => {
                getByTestId('set-project').click();
            });
            expect(handler).toHaveBeenCalled();
            const event = handler.mock.calls[0][0] as CustomEvent;
            expect(event.detail.mode).toBe('list');
            window.removeEventListener('youkan-project-view-mode-change', handler);
        });
    });

    describe('ViewModeProvider 外で useViewMode を呼ぶ', () => {
        it('Provider 外で useViewMode を呼ぶとエラーをスローする', () => {
            const originalError = console.error;
            console.error = () => {};
            expect(() => render(<OutsideConsumer />)).toThrow();
            console.error = originalError;
        });
    });
});
