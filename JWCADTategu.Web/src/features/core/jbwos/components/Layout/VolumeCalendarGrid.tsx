import React from 'react';
import { format, addMonths, subMonths } from 'date-fns';
import { VolumeDayCell } from './VolumeDayCell';
import { useVolumeCalendarViewModel } from '../../viewmodels/useVolumeCalendarViewModel';
import { TaskVolume, VolumeSettings } from '../../services/VolumeService';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { VolumeConnectionLayer } from './VolumeConnectionLayer';

interface VolumeCalendarGridProps {
    tasks: TaskVolume[];
    settings: VolumeSettings;
}

export const VolumeCalendarGrid: React.FC<VolumeCalendarGridProps> = ({ tasks, settings }) => {
    const { state, actions } = useVolumeCalendarViewModel(tasks, settings);

    const weekDays = ['日', '月', '火', '水', '木', '金', '土'];

    return (
        <div className="flex flex-col h-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
                <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">
                    {format(state.currentMonth, 'yyyy年 M月')}
                </h2>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => actions.changeMonth(-1)}
                        className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                    >
                        <ChevronLeft size={20} />
                    </button>
                    <button
                        onClick={() => actions.changeMonth(1)}
                        className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                    >
                        <ChevronRight size={20} />
                    </button>
                </div>
            </div>

            {/* Weekdays Header */}
            <div className="grid grid-cols-7 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
                {weekDays.map(day => (
                    <div key={day} className="py-2 text-center text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                        {day}
                    </div>
                ))}
            </div>

            {/* Grid Body */}
            <div className="relative flex-grow grid grid-cols-7 auto-rows-fr">
                {state.days.map(day => {
                    const dateStr = format(day, 'yyyy-MM-dd');
                    return (
                        <VolumeDayCell
                            key={dateStr}
                            date={day}
                            currentMonth={state.currentMonth}
                            volume={state.dailyVolumes[dateStr]}
                            isSelected={state.selectedDate === dateStr}
                            onClick={() => actions.selectDate(dateStr)}
                            onDoubleClick={() => console.log('Double Click Date:', dateStr)}
                        />
                    );
                })}

                {/* SVG Connection Layer */}
                <VolumeConnectionLayer
                    selectedDate={state.selectedDate}
                    dailyVolumes={state.dailyVolumes}
                />
            </div>
        </div>
    );
};
