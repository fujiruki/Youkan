import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { YOUKAN_KEYS, YOUKAN_EVENTS } from '../../session/youkanKeys';

type DashboardViewMode = 'stream' | 'panorama' | 'overview' | 'calendar';
type ProjectViewMode = 'grid' | 'list';
type CalendarViewMode = 'grid' | 'timeline' | 'gantt';

interface ViewModeContextType {
    dashboardViewMode: DashboardViewMode;
    setDashboardViewMode: (mode: DashboardViewMode) => void;
    projectViewMode: ProjectViewMode;
    setProjectViewMode: (mode: ProjectViewMode) => void;
    calendarViewMode: CalendarViewMode;
    setCalendarViewMode: (mode: CalendarViewMode) => void;
}

const ViewModeContext = createContext<ViewModeContextType | undefined>(undefined);

export const ViewModeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [dashboardViewMode, setDashboardViewModeState] = useState<DashboardViewMode>(() => {
        const saved = localStorage.getItem(YOUKAN_KEYS.VIEW_MODE);
        return (saved as DashboardViewMode) || 'stream';
    });

    const [projectViewMode, setProjectViewModeState] = useState<ProjectViewMode>(() => {
        const saved = localStorage.getItem(YOUKAN_KEYS.PROJECT_VIEW_MODE);
        return (saved as ProjectViewMode) || 'grid';
    });

    const [calendarViewMode, setCalendarViewModeState] = useState<CalendarViewMode>(() => {
        const saved = localStorage.getItem(YOUKAN_KEYS.CALENDAR_VIEW_MODE);
        return (saved as CalendarViewMode) || 'grid';
    });

    const setDashboardViewMode = useCallback((mode: DashboardViewMode) => {
        setDashboardViewModeState(mode);
        localStorage.setItem(YOUKAN_KEYS.VIEW_MODE, mode);
        window.dispatchEvent(new CustomEvent(YOUKAN_EVENTS.VIEW_MODE_CHANGE, { detail: { mode } }));
    }, []);

    const setProjectViewMode = useCallback((mode: ProjectViewMode) => {
        setProjectViewModeState(mode);
        localStorage.setItem(YOUKAN_KEYS.PROJECT_VIEW_MODE, mode);
        window.dispatchEvent(new CustomEvent(YOUKAN_EVENTS.PROJECT_VIEW_MODE_CHANGE, { detail: { mode } }));
    }, []);

    const setCalendarViewMode = useCallback((mode: CalendarViewMode) => {
        setCalendarViewModeState(mode);
        localStorage.setItem(YOUKAN_KEYS.CALENDAR_VIEW_MODE, mode);
        window.dispatchEvent(new CustomEvent(YOUKAN_EVENTS.CALENDAR_VIEW_MODE_CHANGE, { detail: { mode } }));
    }, []);

    return (
        <ViewModeContext.Provider value={{
            dashboardViewMode,
            setDashboardViewMode,
            projectViewMode,
            setProjectViewMode,
            calendarViewMode,
            setCalendarViewMode,
        }}>
            {children}
        </ViewModeContext.Provider>
    );
};

export const useViewMode = () => {
    const context = useContext(ViewModeContext);
    if (!context) {
        throw new Error('useViewMode must be used within a ViewModeProvider');
    }
    return context;
};
