import React, { useState, useEffect } from 'react';
import { startOfMonth, subMonths, addMonths } from 'date-fns';
import { useSmartContext } from './useSmartContext';
// import { useQuantityMatrix } from './useQuantityMatrix'; // Handled by wrapper now
import { MonthlyGridWrapper } from './MonthlyGridWrapper';
import { LocalFilterSwitcher } from './LocalFilterSwitcher';

interface DetailQuantityCalendarProps {
    item: { id: string; isPrivate?: boolean; title?: string } | null; // Generic item interface
    globalFilter: string;
    selectedDate?: Date | null;
    prepDate?: Date | null;
    onSelectDate?: (date: Date) => void;
}

export const DetailQuantityCalendar: React.FC<DetailQuantityCalendarProps> = ({
    item,
    globalFilter,
    selectedDate,
    prepDate,
    onSelectDate
}) => {
    // 1. Determine Smart Context
    const smartContext = useSmartContext({ item, globalFilter });

    // 2. Allow Manual Override (Local State)
    const [activeContext, setActiveContext] = useState(smartContext);

    // Display Mode State
    const [displayMode, setDisplayMode] = useState<'default' | 'volume_only'>('volume_only'); // Default to volume_only as per request

    // Infinite Scroll State
    const [visibleMonths, setVisibleMonths] = useState<Date[]>([]);
    const scrollContainerRef = React.useRef<HTMLDivElement>(null);
    const [isLoadingMore, setIsLoadingMore] = useState(false);

    // Sync activeContext
    useEffect(() => {
        setActiveContext(smartContext);
    }, [smartContext]);

    // Initialize Months (Centered on today or selectedDate)
    useEffect(() => {
        const centerDate = selectedDate || new Date();
        const start = startOfMonth(centerDate);
        // Initial load: 1 month before, current, 1 month after
        const months = [
            subMonths(start, 1),
            start,
            addMonths(start, 1),
            addMonths(start, 2) // Extra month for visibility
        ];
        setVisibleMonths(months);

        // Initial scroll to center (optional, difficult to time correctly without layout effect)
        // setTimeout(() => {
        //     if (scrollContainerRef.current) {
        //         // Rough center
        //         scrollContainerRef.current.scrollTop = 100;
        //     }
        // }, 100);
    }, [selectedDate]);

    // Scroll Handler for Infinite Scroll
    const handleScroll = () => {
        if (!scrollContainerRef.current || isLoadingMore) return;

        const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
        const threshold = 100; // px

        // Load Previous
        if (scrollTop < threshold) {
            loadPreviousMonth();
        }

        // Load Next
        if (scrollTop + clientHeight > scrollHeight - threshold) {
            loadNextMonth();
        }
    };

    const loadPreviousMonth = () => {
        setIsLoadingMore(true);
        const firstMonth = visibleMonths[0];
        const newMonth = subMonths(firstMonth, 1);

        // Save current scroll height to restore position
        const container = scrollContainerRef.current;
        const oldScrollHeight = container?.scrollHeight || 0;

        setVisibleMonths(prev => [newMonth, ...prev]);

        // Restore scroll position after render
        // This is tricky in React async state. 
        // Using layout effect or generic timeout for now.
        setTimeout(() => {
            if (container) {
                const newScrollHeight = container.scrollHeight;
                container.scrollTop = newScrollHeight - oldScrollHeight + container.scrollTop;
            }
            setIsLoadingMore(false);
        }, 50);
    };

    const loadNextMonth = () => {
        setIsLoadingMore(true);
        const lastMonth = visibleMonths[visibleMonths.length - 1];
        const newMonth = addMonths(lastMonth, 1);

        setVisibleMonths(prev => [...prev, newMonth]);

        setTimeout(() => {
            setIsLoadingMore(false);
        }, 50);
    };

    return (
        <div className="flex flex-col gap-2 w-full h-full border border-slate-200 dark:border-slate-700 rounded-lg p-2 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
            {/* Header / Switcher */}
            <div className="flex items-center justify-between mb-1 shrink-0">
                <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">
                        Load Context
                    </span>
                    {/* Display Mode Toggle */}
                    <button
                        onClick={() => setDisplayMode(prev => prev === 'default' ? 'volume_only' : 'default')}
                        className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors ${displayMode === 'volume_only'
                            ? 'bg-indigo-100 text-indigo-600 border-indigo-200'
                            : 'bg-slate-50 text-slate-400 border-slate-200'
                            }`}
                        title="Toggle Volume Only Mode"
                    >
                        {displayMode === 'volume_only' ? 'Vol' : 'Detail'}
                    </button>
                </div>
                <div className="w-32">
                    <LocalFilterSwitcher
                        currentContext={activeContext}
                        onContextChange={setActiveContext}
                    />
                </div>
            </div>

            {/* Calendar Grid Container (Infinite Scroll) */}
            <div
                ref={scrollContainerRef}
                onScroll={handleScroll}
                className="flex-1 overflow-y-auto relative scroll-smooth"
            >
                <div className="flex flex-col gap-4 pb-4">
                    {visibleMonths.map((month) => (
                        <MonthlyGridWrapper
                            key={month.toISOString()}
                            monthDate={month}
                            filterMode={activeContext as any}
                            selectedDate={selectedDate}
                            prepDate={prepDate}
                            onSelectDate={onSelectDate}
                            displayMode={displayMode}
                            // Pass currentItem if needed for logic context
                            currentItem={item as any}
                        />
                    ))}
                    {isLoadingMore && <div className="h-4"></div>}
                </div>
            </div>

            {/* Legend / Info */}
            <div className="flex gap-2 px-1 shrink-0 pt-1 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-blue-500/20"></div>
                    <span className="text-[9px] text-slate-400">Low</span>
                </div>
                <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                    <span className="text-[9px] text-slate-400">High</span>
                </div>
                {displayMode === 'default' && (
                    <div className="flex items-center gap-1 ml-auto">
                        <div className="w-0 h-0 border-l-[6px] border-b-[6px] border-l-transparent border-b-slate-400/50"></div>
                        <span className="text-[9px] text-slate-400">Over</span>
                    </div>
                )}
            </div>
        </div>
    );
};
