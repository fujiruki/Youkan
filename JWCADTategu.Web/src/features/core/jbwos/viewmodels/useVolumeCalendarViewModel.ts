import { useState, useMemo, useCallback, useEffect } from 'react';
import {
    startOfMonth,
    endOfMonth,
    startOfWeek,
    endOfWeek,
    eachDayOfInterval,
    addMonths,
    format
} from 'date-fns';
import { VolumeService, DailyVolume, TaskVolume, VolumeSettings } from '../services/VolumeService';

export interface VolumeCalendarState {
    currentMonth: Date;
    days: Date[];
    dailyVolumes: Record<string, DailyVolume>;
    selectedDate: string | null;
    hoveredItemId: string | null;
}

export const useVolumeCalendarViewModel = (tasks: TaskVolume[], settings: VolumeSettings) => {
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState<string | null>(null);
    const [hoveredItemId, setHoveredItemId] = useState<string | null>(null);

    // Calculate days to display (full weeks of the current month)
    const days = useMemo(() => {
        const start = startOfWeek(startOfMonth(currentMonth));
        const end = endOfWeek(endOfMonth(currentMonth));
        return eachDayOfInterval({ start, end });
    }, [currentMonth]);

    // Calculate volumes for the displayed range
    const dailyVolumes = useMemo(() => {
        if (days.length === 0) return {};
        const startDateStr = format(days[0], 'yyyy-MM-dd');
        const endDateStr = format(days[days.length - 1], 'yyyy-MM-dd');
        return VolumeService.calculateDailyVolumes(tasks, settings, startDateStr, endDateStr);
    }, [tasks, settings, days]);

    const changeMonth = useCallback((offset: number) => {
        setCurrentMonth(prev => addMonths(prev, offset));
    }, []);

    const selectDate = useCallback((dateStr: string) => {
        setSelectedDate(prev => prev === dateStr ? null : dateStr);
    }, []);

    const setHoveredItem = useCallback((itemId: string | null) => {
        setHoveredItemId(itemId);
    }, []);

    // Helper: find items contributing to a specific date
    const getItemsForDate = useCallback((dateStr: string): TaskVolume[] => {
        return dailyVolumes[dateStr]?.tasks || [];
    }, [dailyVolumes]);

    return {
        state: {
            currentMonth,
            days,
            dailyVolumes,
            selectedDate,
            hoveredItemId
        },
        actions: {
            changeMonth,
            selectDate,
            setHoveredItem,
            getItemsForDate
        }
    };
};
