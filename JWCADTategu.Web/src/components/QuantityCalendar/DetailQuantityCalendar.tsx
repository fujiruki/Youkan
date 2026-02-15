import React from 'react';
import { Item, Member, CapacityConfig, FilterMode, JoinedTenant } from '../../features/core/jbwos/types';
import { RyokanCalendar } from '../../features/core/jbwos/components/Calendar/RyokanCalendar';

interface DetailQuantityCalendarProps {
    item: { id: string; isPrivate?: boolean; title?: string } | null;
    globalFilter: FilterMode;
    selectedDate?: Date | null;
    prepDate?: Date | null;
    onSelectDate?: (date: Date) => void;
    // Data Props
    items?: Item[];
    members?: Member[];
    capacityConfig?: CapacityConfig;
    projects?: Item[];
    joinedTenants?: JoinedTenant[];
    targetItemId?: string;
    commitPeriod?: Date[];
}

export const DetailQuantityCalendar: React.FC<DetailQuantityCalendarProps> = ({
    item: _item,
    globalFilter,
    selectedDate,
    prepDate,
    onSelectDate,
    items = [],
    members = [],
    capacityConfig,
    projects = [],
    joinedTenants = [],
    targetItemId,
    commitPeriod
}) => {
    // [NEW] Local Volume Only Toggle
    const [isVolumeOnly, setIsVolumeOnly] = React.useState(false);

    return (
        <div className="flex flex-col w-full h-full border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden bg-white dark:bg-slate-900 shadow-sm">
            {/* Minimal Header with Toggle */}
            <div className="flex items-center justify-between px-2 py-1 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-800 shrink-0">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    Calendar Mode
                </span>
                <button
                    onClick={() => setIsVolumeOnly(!isVolumeOnly)}
                    className={`text-[10px] px-2 py-0.5 rounded border transition-colors font-bold ${isVolumeOnly
                        ? 'bg-indigo-100 text-indigo-600 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-800'
                        : 'bg-white text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
                        }`}
                >
                    {isVolumeOnly ? 'Volume Only' : 'Detailed'}
                </button>
            </div>

            <div className="flex-1 overflow-hidden relative">
                <RyokanCalendar
                    items={items}
                    members={members}
                    capacityConfig={capacityConfig}
                    projects={projects}
                    joinedTenants={joinedTenants}

                    layoutMode="mini"
                    displayMode="grid"
                    filterMode={globalFilter}

                    selectedDate={selectedDate} // Due Date (Red)
                    prepDate={prepDate}         // My Deadline (Blue)
                    focusDate={selectedDate || prepDate || new Date()}
                    onSelectDate={onSelectDate} // Handle click to set date

                    volumeOnly={isVolumeOnly}
                    hideHeader={true}  // Hide standard header

                    targetItemId={targetItemId}
                    commitPeriod={commitPeriod}

                // Allow default RyokanCalendar behavior for dateClick (Show Breakdown)
                />
            </div>
        </div>
    );
};
