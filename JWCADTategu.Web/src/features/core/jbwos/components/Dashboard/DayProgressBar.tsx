import React from 'react';

interface DayProgressBarProps {
    usedMinutes: number;
    limitMinutes: number;
    className?: string;
}

export const DayProgressBar: React.FC<DayProgressBarProps> = ({ usedMinutes, limitMinutes, className = '' }) => {
    const percentage = Math.min(100, Math.max(0, (usedMinutes / limitMinutes) * 100));
    const isOver = usedMinutes > limitMinutes;

    // Color Logic
    let colorClass = 'bg-emerald-400';
    if (percentage > 80) colorClass = 'bg-amber-400';
    if (percentage >= 100) colorClass = 'bg-rose-500';

    return (
        <div className={`w-full ${className}`}>
            <div className="flex justify-between items-end mb-1">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">判断キャパシティ</span>
                <span className={`text-xs font-mono font-medium ${isOver ? 'text-rose-500' : 'text-slate-500'}`}>
                    {usedMinutes}分 / {limitMinutes}分
                </span>
            </div>
            <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden shadow-inner">
                <div
                    className={`h-full ${colorClass} transition-all duration-500 ease-out`}
                    style={{ width: `${percentage}%` }}
                />
            </div>
            {isOver && (
                <div className="mt-1 text-[10px] text-rose-500 text-right">
                    ⚠️ キャパシティ超過: {usedMinutes - limitMinutes}分
                </div>
            )}
        </div>
    );
};
