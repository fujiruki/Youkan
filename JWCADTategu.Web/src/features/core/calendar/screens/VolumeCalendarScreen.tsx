
import React from 'react';
import { useVolumeCalendarViewModel } from '../viewmodels/useVolumeCalendarViewModel';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday } from 'date-fns';
import { ArrowLeft, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';

interface VolumeCalendarScreenProps {
    onNavigateHome: () => void;
}

export const VolumeCalendarScreen: React.FC<VolumeCalendarScreenProps> = ({
    onNavigateHome
}) => {
    const { currentDate, dailyLoads, loading, nextMonth, prevMonth } = useVolumeCalendarViewModel();

    const days = eachDayOfInterval({
        start: startOfMonth(currentDate),
        end: endOfMonth(currentDate)
    });

    // Color Scale Helper
    const getLevelColor = (minutes: number, capacity: number = 480) => {
        const usage = minutes / capacity;
        if (usage === 0) return 'bg-white';
        if (usage <= 0.5) return 'bg-orange-100'; // Low
        if (usage <= 1.0) return 'bg-orange-300'; // Mid
        if (usage <= 1.5) return 'bg-orange-500 text-white'; // High
        return 'bg-amber-900 text-white'; // Over (Brown/Burnt Orange)
    };

    return (
        <div className="min-h-screen bg-slate-50 text-slate-800 font-sans flex flex-col">
            {/* Header */}
            <div className="bg-slate-800 text-slate-200 px-6 py-4 flex items-center justify-between shadow-sm z-10">
                <div className="flex items-center gap-4">
                    <button onClick={onNavigateHome} className="hover:text-white transition-colors">
                        <ArrowLeft />
                    </button>
                    <h1 className="text-lg font-medium text-white flex items-center gap-2">
                        <span>Volume Calendar</span>
                        <span className="text-slate-500 text-sm">| Early Completion Game</span>
                    </h1>
                </div>

                <div className="flex items-center gap-4">
                    <button onClick={prevMonth} className="p-1 hover:bg-slate-700 rounded"><ChevronLeft /></button>
                    <span className="text-lg font-bold w-32 text-center">{format(currentDate, 'yyyy MMMM')}</span>
                    <button onClick={nextMonth} className="p-1 hover:bg-slate-700 rounded"><ChevronRight /></button>
                </div>
            </div>

            {/* Calendar Grid */}
            <div className="flex-1 p-4 md:p-8 overflow-y-auto">
                <div className="max-w-6xl mx-auto">
                    {loading && (
                        <div className="flex justify-center py-4 text-slate-400 gap-2">
                            <Loader2 className="animate-spin" /> Calculating Volume...
                        </div>
                    )}

                    <div className="grid grid-cols-7 gap-px bg-slate-200 border border-slate-200 rounded-lg overflow-hidden shadow-sm">
                        {/* Days Header */}
                        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                            <div key={day} className="bg-slate-50 py-2 text-center text-xs font-bold text-slate-500">
                                {day}
                            </div>
                        ))}

                        {/* Days */}
                        {days.map(day => {
                            const dateStr = format(day, 'yyyy-MM-dd');
                            const load = dailyLoads[dateStr] || { minutes: 0, items: [] };
                            const colorClass = getLevelColor(load.minutes);
                            const isCurrentMonth = isSameMonth(day, currentDate);
                            const isTodayDate = isToday(day);

                            return (
                                <div
                                    key={dateStr}
                                    className={`min-h-[120px] p-2 relative transition-colors ${colorClass} ${!isCurrentMonth ? 'opacity-30' : ''}`}
                                >
                                    <div className="flex justify-between items-start">
                                        <span className={`text-sm font-bold ${isTodayDate ? 'bg-indigo-600 text-white rounded-full w-6 h-6 flex items-center justify-center' : ''}`}>
                                            {format(day, 'd')}
                                        </span>
                                        {load.minutes > 0 && (
                                            <span className="text-xs font-mono opacity-80">
                                                {Math.round(load.minutes / 60 * 10) / 10}h
                                            </span>
                                        )}
                                    </div>

                                    {/* Item Stacks (Visual Only) */}
                                    <div className="mt-2 space-y-1">
                                        {load.items.map((alloc, idx) => (
                                            <div key={idx} className="text-xs truncate px-1 py-0.5 rounded bg-black/10" title={`${alloc.item.title} (${alloc.allocatedMinutes}m)`}>
                                                {alloc.item.title}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
};
