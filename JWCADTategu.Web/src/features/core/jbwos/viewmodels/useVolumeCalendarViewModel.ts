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
    // currentMonth: Date; // Removed
    days: Date[];
    dailyVolumes: Record<string, DailyVolume & { isHighlighted?: boolean }>;
    selectedDate: string | null;
    highlightedTaskId: string | null;
    activeContextId: string | 'all' | 'company';
    nothingDays: string[];
}

export const useVolumeCalendarViewModel = (
    tasks: TaskVolume[],
    initialSettings: VolumeSettings
) => {
    const [activeContextId, setActiveContextId] = useState<string | 'all' | 'company'>('all');
    const [selectedDate, setSelectedDate] = useState<string | null>(null);
    const [highlightedTaskId, setHighlightedTaskId] = useState<string | null>(null);

    // [MODIFIED] Infinite Scroll State
    // Initial range: Last month start -> Next 2 months end
    const [activeRange, setActiveRange] = useState<{ start: Date; end: Date }>(() => {
        const now = new Date();
        return {
            start: startOfWeek(startOfMonth(subMonths(now, 1))),
            end: endOfWeek(endOfMonth(addMonths(now, 2)))
        };
    });

    // We maintain nothingDays locally for the simulation, but in a real app 
    // this would probably be persisted back to the server/settings.
    const [nothingDays, setNothingDays] = useState<string[]>(initialSettings.nothingDays || []);

    // Calculate days to display based on activeRange
    const days = useMemo(() => {
        return eachDayOfInterval({ start: activeRange.start, end: activeRange.end });
    }, [activeRange]);

    // Construct the settings object with current local state
    const currentSettings = useMemo((): VolumeSettings => ({
        ...initialSettings,
        nothingDays
    }), [initialSettings, nothingDays]);

    // Calculate volumes for the displayed range
    const baseVolumes = useMemo(() => {
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

    // [NEW] Enhanced Volumes with Highlight Info
    const extendedVolumes = useMemo(() => {
        if (!highlightedTaskId) return baseVolumes;

        const result: Record<string, DailyVolume & { isHighlighted?: boolean }> = {};
        Object.entries(baseVolumes).forEach(([date, vol]) => {
            const hasTask = vol.tasksContributingToThisDay.some(t => t.id === highlightedTaskId) ||
                vol.tasksEndingOnThisDay.some(t => t.id === highlightedTaskId);
            result[date] = { ...vol, isHighlighted: hasTask };
        });
        return result;
    }, [baseVolumes, highlightedTaskId]);

    const loadNextMonth = useCallback(() => {
        setActiveRange(prev => {
            // Extend end date by 1 month (but ensure it covers full weeks)
            // We take the current end date, add 1 month, then extend to end of week/month
            // To be safe, let's take the first day of the next month relative to current end
            // Actually, simply adding 1 month to the current end is safer
            const newEndBase = addMonths(prev.end, 1);
            const newEnd = endOfWeek(endOfMonth(newEndBase));
            return { ...prev, end: newEnd };
        });
    }, []);

    const selectDate = useCallback((dateStr: string) => {
        setSelectedDate(prev => prev === dateStr ? null : dateStr);
    }, []);

    const highlightTask = useCallback((taskId: string | null) => {
        setHighlightedTaskId(taskId);
    }, []);

    const setFilterContext = useCallback((contextId: string | 'all' | 'company') => {
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
        const dayVolume = extendedVolumes[dateStr];
        if (!dayVolume) return [];

        const allTasks = [...dayVolume.tasksContributingToThisDay, ...dayVolume.tasksEndingOnThisDay];
        const uniqueIds = new Set();
        return allTasks.filter(t => {
            if (uniqueIds.has(t.id)) return false;
            uniqueIds.add(t.id);
            return true;
        });
    }, [extendedVolumes]);

    return {
        state: {
            days,
            dailyVolumes: extendedVolumes,
            selectedDate,
            highlightedTaskId,
            activeContextId,
            nothingDays
        },
        actions: {
            loadNextMonth,
            selectDate,
            highlightTask,
            setFilterContext,
            toggleNothingDay,
            getItemsForDate
        }
    };
};
