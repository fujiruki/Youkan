import { useState, useMemo, useCallback } from 'react';
import {
    startOfMonth,
    endOfMonth,
    startOfWeek,
    endOfWeek,
    eachDayOfInterval,
    addMonths,
    subMonths,
    format
} from 'date-fns';
import { VolumeService, DailyVolume, TaskVolume, VolumeSettings } from '../services/VolumeService';

export interface VolumeCalendarState {
    currentMonth: Date;
    days: Date[];
    dailyVolumes: Record<string, DailyVolume>;
    selectedDate: string | null;
    hoveredItemId: string | null;
    activeContextId: string | 'all';
    nothingDays: string[];
}

export const useVolumeCalendarViewModel = (
    tasks: TaskVolume[],
    initialSettings: VolumeSettings
) => {
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState<string | null>(null);
    const [hoveredItemId, setHoveredItemId] = useState<string | null>(null);
    const [activeContextId, setActiveContextId] = useState<string | 'all'>('all');

    // We maintain nothingDays locally for the simulation, but in a real app 
    // this would probably be persisted back to the server/settings.
    const [nothingDays, setNothingDays] = useState<string[]>(initialSettings.nothingDays || []);

    // Calculate days to display (full weeks of the current month)
    const days = useMemo(() => {
        // [MODIFIED] Seamless Range: Previous Month to Next Month (approx 3 months)
        // This provides natural scrolling without hard month boundaries.
        const start = startOfWeek(startOfMonth(subMonths(currentMonth, 1)));
        const end = endOfWeek(endOfMonth(addMonths(currentMonth, 1)));
        return eachDayOfInterval({ start, end });
    }, [currentMonth]);

    // Construct the settings object with current local state
    const currentSettings = useMemo((): VolumeSettings => ({
        ...initialSettings,
        nothingDays
    }), [initialSettings, nothingDays]);

    // Calculate volumes for the displayed range
    const dailyVolumes = useMemo(() => {
        if (days.length === 0) return {};
        const startDateStr = format(days[0], 'yyyy-MM-dd');
        const endDateStr = format(days[days.length - 1], 'yyyy-MM-dd');

        return VolumeService.calculateDailyVolumes(
            tasks,
            currentSettings,
            startDateStr,
            endDateStr,
            activeContextId
        );
    }, [tasks, currentSettings, days, activeContextId]);

    const changeMonth = useCallback((offset: number) => {
        setCurrentMonth(prev => addMonths(prev, offset));
    }, []);

    const selectDate = useCallback((dateStr: string) => {
        setSelectedDate(prev => prev === dateStr ? null : dateStr);
    }, []);

    const setHoveredItem = useCallback((itemId: string | null) => {
        setHoveredItemId(itemId);
    }, []);

    const setFilterContext = useCallback((contextId: string | 'all') => {
        setActiveContextId(contextId);
    }, []);

    const toggleNothingDay = useCallback((dateStr: string) => {
        setNothingDays(prev =>
            prev.includes(dateStr)
                ? prev.filter(d => d !== dateStr)
                : [...prev, dateStr]
        );
    }, []);

    const getItemsForDate = useCallback((dateStr: string): TaskVolume[] => {
        // Logic change: return combined tasks from both contribution and deadline
        const dayVolume = dailyVolumes[dateStr];
        if (!dayVolume) return [];

        // Return unique tasks
        const allTasks = [...dayVolume.tasksContributingToThisDay, ...dayVolume.tasksEndingOnThisDay];
        const uniqueIds = new Set();
        return allTasks.filter(t => {
            if (uniqueIds.has(t.id)) return false;
            uniqueIds.add(t.id);
            return true;
        });
    }, [dailyVolumes]);

    return {
        state: {
            currentMonth,
            days,
            dailyVolumes,
            selectedDate,
            hoveredItemId,
            activeContextId,
            nothingDays
        },
        actions: {
            changeMonth,
            selectDate,
            setHoveredItem,
            setFilterContext,
            toggleNothingDay,
            getItemsForDate
        }
    };
};
