import React from 'react';
import { cn } from '../../../../../lib/utils';

import { FilterMode } from '../../types';
import { Briefcase, User, Layers } from 'lucide-react';

interface HeaderProgressBarProps {
    usedMinutes: number;
    limitMinutes: number;
    filterMode?: FilterMode;
    onFilterChange?: (mode: FilterMode) => void;
    ghostCount?: number;
    isProjectContext?: boolean;
    className?: string;
}

/**
 * 0:00 - 24:00 のタイムバーを表示するヘッダープログレスバー
 * 超高密度表示に対応し、1日の負荷状況を視覚化する。
 */
export const HeaderProgressBar: React.FC<HeaderProgressBarProps> = ({
    usedMinutes,
    limitMinutes,
    filterMode = 'all',
    onFilterChange,
    ghostCount = 0,
    isProjectContext = false,
    className
}) => {
    const progress = Math.min((usedMinutes / limitMinutes) * 100, 100);
    const isOver = usedMinutes > limitMinutes;

    // Listen for global filter changes
    React.useEffect(() => {
        const handleGlobalFilterChange = (e: any) => {
            const newMode = e.detail?.mode;
            if (newMode && newMode !== filterMode && onFilterChange) {
                // We don't call onFilterChange here to avoid loops if both are syncing,
                // but HeaderProgressBar usually is the one triggering it.
                // Actually, HeaderProgressBar prop 'filterMode' should come from the parent (ViewModel).
                // So we just need to make sure the trigger dispatches the event.
            }
        };
        window.addEventListener('jbwos-filter-change', handleGlobalFilterChange);
        return () => window.removeEventListener('jbwos-filter-change', handleGlobalFilterChange);
    }, [filterMode, onFilterChange]);

    const handleFilterClick = (mode: FilterMode) => {
        if (onFilterChange) {
            onFilterChange(mode);
            // Dispatching is handled by the ViewModel effect, but we can do it here for immediate feedback if needed.
            // However, since ViewModel handles it, we'll let it flow through props.
        }
    };

    return (
        <div className={cn("sticky top-0 z-50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-4 py-2 shadow-sm transition-all", className)}>
            <div className="max-w-4xl mx-auto flex flex-col gap-2">
                <div className="flex justify-between items-center gap-4">
                    {/* Left: Capacity Info */}
                    <div className="flex items-center gap-3">
                        <div className="flex flex-col">
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">
                                {isProjectContext ? 'Project Task Load' : 'Reality (Total Load)'}
                            </span>
                            <div className="flex items-center gap-2">
                                <span className={cn(
                                    "text-sm font-mono font-bold leading-none",
                                    isOver ? "text-red-500" : isProjectContext ? "text-blue-600 dark:text-blue-400" : "text-indigo-600 dark:text-indigo-400"
                                )}>
                                    {usedMinutes} / {limitMinutes} <span className="text-[10px] opacity-70">min</span>
                                </span>
                                <span className="text-[10px] font-mono text-slate-400">
                                    ({Math.round(progress)}%)
                                </span>
                            </div>
                        </div>

                        {/* Ghost Indicator (Haruki's Reality Nudge) - Hide if in project context */}
                        {ghostCount > 0 && filterMode !== 'all' && !isProjectContext && (
                            <div className="flex items-center gap-1.5 px-2 py-1 bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800/50 rounded-md animate-in fade-in zoom-in duration-300">
                                <span className="relative flex h-1.5 w-1.5">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-500"></span>
                                </span>
                                <span className="text-[9px] font-bold text-amber-600 dark:text-amber-400 whitespace-nowrap">
                                    {ghostCount} items in ghost-view
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Middle: 24h Bar (Integrated into header flow) */}
                    <div className="flex-1 max-w-sm hidden lg:block">
                        <div className="relative h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex">
                            <div
                                className={cn(
                                    "absolute top-0 left-0 h-full transition-all duration-700 ease-out",
                                    isOver ? "bg-red-400" : isProjectContext ? "bg-blue-400" : "bg-indigo-400"
                                )}
                                style={{ width: `${progress}%`, opacity: 0.4 }}
                            />
                            <div className="absolute inset-0 flex gap-[1px] px-[2px]">
                                {Array.from({ length: 24 }).map((_, i) => (
                                    <div key={i} className={cn("h-full flex-1", i >= 8 && i <= 18 ? "bg-slate-200/40 dark:bg-slate-700/20" : "bg-transparent")} />
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Right: Filter Lens (Option 3 Implementation) - Hide if in project context */}
                    {!isProjectContext ? (
                        <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700 shadow-inner">
                            <span className="text-[9px] font-bold text-slate-400 px-2 uppercase tracking-tight">フィルタ:</span>
                            <FilterButton
                                active={filterMode === 'all'}
                                onClick={() => handleFilterClick('all')}
                                icon={<Layers size={14} />}
                                label="Integrated"
                            />
                            <FilterButton
                                active={filterMode === 'company'}
                                onClick={() => handleFilterClick('company')}
                                icon={<Briefcase size={14} />}
                                label="Company"
                            />
                            <FilterButton
                                active={filterMode === 'personal'}
                                onClick={() => handleFilterClick('personal')}
                                icon={<User size={14} />}
                                label="Personal"
                            />
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 px-3 py-1 bg-blue-50 dark:bg-blue-900/30 border border-blue-100 dark:border-blue-800 rounded-lg shadow-sm">
                            <Briefcase size={14} className="text-blue-500" />
                            <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-tighter">Project Focused</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const FilterButton = ({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) => (
    <button
        onClick={onClick}
        className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[10px] font-bold transition-all whitespace-nowrap",
            active
                ? "bg-white dark:bg-slate-600 text-indigo-600 dark:text-white shadow-sm scale-[1.02]"
                : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
        )}
    >
        {icon}
        <span className="hidden sm:inline">{label}</span>
    </button>
);
