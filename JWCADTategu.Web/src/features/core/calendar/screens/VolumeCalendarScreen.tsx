import React, { useMemo } from 'react';
import { useVolumeCalendarViewModel } from '../viewmodels/useVolumeCalendarViewModel';
import { RyokanCalendar } from '../../jbwos/components/Calendar/RyokanCalendar';
import { Loader2, AlertCircle } from 'lucide-react';
import { Item } from '../../jbwos/types';

interface Props {
    onNavigateHome: () => void;
}

export const VolumeCalendarScreen: React.FC<Props> = ({ onNavigateHome }) => {
    const { currentDate, dailyLoads, loading, error, nextMonth, prevMonth, refresh } = useVolumeCalendarViewModel();

    // Adapter Logic: Convert DailyLoadMap (minutes) to Injection Map (normalized ratio)
    // DailyLoadMap: { [date: string]: { minutes: number, items: ... } }
    // Injection Map: DateString -> Ratio (0.0 - 2.0+)
    // If capacity is 480 mins.
    // 480 mins -> 1.0
    // We want 1.0 to result in a decent color.
    // QuantityCalendar uses: volume * intensityScale = opacity% (max 60).
    // If we set intensityScale = 40.
    // 1.0 * 40 = 40%. (Mid-high)
    // 1.5 * 40 = 60%. (Max)
    // 0.5 * 40 = 20%. (Low)
    // Seems reasonable.

    const adapterResult = useMemo(() => {
        const map = new Map<string, number>();
        const capacity = 480; // Should match VM logic or be passed from VM

        const uniqueItems = new Map<string, Item>();
        Object.values(dailyLoads).forEach(load => {
            load.items.forEach(alloc => {
                uniqueItems.set(alloc.item.id, alloc.item);
            });
        });

        // Volume Map
        Object.entries(dailyLoads).forEach(([dateStr, load]) => {
            // dateStr is yyyy-MM-dd. Need to convert totoDateString() format to match QuantityCalendar logic.
            const [y, m, dNum] = dateStr.split('-').map(Number);
            const dateObj = new Date(y, m - 1, dNum);

            const key = dateObj.toDateString();
            const ratio = load.minutes / capacity;
            map.set(key, ratio);
        });

        return {
            items: Array.from(uniqueItems.values()),
            volumeMap: map
        };
    }, [dailyLoads]);

    if (loading) {
        return (
            <div className="flex items-center justify-center p-20 text-slate-500 gap-2">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>読み込み中...</span>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-center justify-center p-20 text-red-500 gap-2">
                <AlertCircle className="w-5 h-5" />
                <span>{error}</span>
                <button onClick={refresh} className="text-blue-500 underline text-sm">再試行</button>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900">
            {/* Header Section (Simplified) */}
            <div className="flex-none p-4 flex items-center justify-between bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <button onClick={prevMonth} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full">
                            ←
                        </button>
                        <span className="font-bold text-lg min-w-[120px] text-center">
                            {currentDate.getFullYear()}年 {currentDate.getMonth() + 1}月
                        </span>
                        <button onClick={nextMonth} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full">
                            →
                        </button>
                    </div>
                    <button onClick={onNavigateHome} className="text-sm text-slate-500 hover:text-slate-700">
                        戻る
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-hidden relative">
                <RyokanCalendar
                    items={adapterResult.items}
                    onItemClick={() => { }}
                    onToggleHoliday={() => { }}
                />
            </div>
        </div>
    );
};
