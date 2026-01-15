import React, { useRef } from 'react';
import { Clock } from 'lucide-react';
import { cn } from '../../../../../lib/utils';
import { DefaultEstimationSettings } from '../../../../../features/plugins/tategu/domain/EstimationSettings';

interface Props {
    value: number; // minutes
    onChange: (val: number) => void;
    className?: string;
}

export const EstimatedTimeInput: React.FC<Props> = ({ value, onChange, className }) => {
    // Determine hours per day logic
    // Ideally fetch from global settings. For now, read from localStorage or default.
    // Since this is a pure component, we might want to pass it prop, but reading local storage here is practical for MVP.
    const getHoursPerDay = () => {
        try {
            const saved = localStorage.getItem('globalEstimationSettings');
            if (saved) {
                const settings = JSON.parse(saved);
                return settings.hoursPerDay || DefaultEstimationSettings.hoursPerDay || 7;
            }
        } catch (e) {
            // ignore
        }
        return DefaultEstimationSettings.hoursPerDay || 7;
    };
    const hoursPerDay = getHoursPerDay();

    // Presets
    const presets = [
        { label: '0.5h', mins: 30 },
        { label: '1h', mins: 60 },
        { label: '2h', mins: 120 },
        { label: '4h', mins: 240 },
        { label: '1日', mins: hoursPerDay * 60 },
        { label: '2日', mins: hoursPerDay * 60 * 2 },
        { label: '3日', mins: hoursPerDay * 60 * 3 },
    ];

    // Days Scroller logic
    const dayOptions = Array.from({ length: 14 }, (_, i) => i + 1); // 1 to 14 days
    const scrollRef = useRef<HTMLDivElement>(null);

    const handleDaySelect = (days: number) => {
        const mins = days * hoursPerDay * 60;
        onChange(mins);
    };

    // Helper to format current value
    const formatValue = (v: number) => {
        if (!v) return '未設定';
        if (v < hoursPerDay * 60) {
            // Hours mode
            const h = v / 60;
            return `${Math.round(h * 10) / 10}時間`; // 1.5時間
        } else {
            // Days mode
            const d = v / (hoursPerDay * 60);
            return `${Math.round(d * 10) / 10}日 (${v / 60}h)`;
        }
    };

    return (
        <div className={cn("space-y-4", className)}>
            <div className="flex items-center gap-2 mb-2">
                <Clock size={16} className="text-slate-400" />
                <span className="text-sm font-bold text-slate-600 dark:text-slate-300">
                    制作目安時間
                </span>
                <span className="ml-auto text-sm font-mono font-medium text-blue-600 dark:text-blue-400">
                    {formatValue(value)}
                </span>
            </div>

            {/* Quick Presets */}
            <div className="flex gap-2">
                {presets.map(p => (
                    <button
                        key={p.label}
                        onClick={() => onChange(p.mins)}
                        className={cn(
                            "flex-1 py-2 rounded text-xs font-bold border transition-all",
                            value === p.mins
                                ? "bg-blue-100 border-blue-500 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200"
                                : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:hover:bg-slate-700"
                        )}
                    >
                        {p.label}
                    </button>
                ))}
            </div>

            {/* Day Scroller */}
            <div className="relative">
                <div className="text-xs text-slate-400 mb-1 text-center font-mono">
                    ▼ 1日 = {hoursPerDay}時間
                </div>
                <div
                    ref={scrollRef}
                    className="flex overflow-x-auto gap-2 pb-2 scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-transparent snap-x"
                >
                    {dayOptions.map(d => {
                        const mins = d * hoursPerDay * 60;
                        const isSelected = Math.abs(value - mins) < 1; // Approx check
                        return (
                            <button
                                key={d}
                                onClick={() => handleDaySelect(d)}
                                className={cn(
                                    "snap-start shrink-0 w-16 h-16 rounded-xl border-2 flex flex-col items-center justify-center transition-all",
                                    isSelected
                                        ? "border-amber-500 bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-200"
                                        : "border-slate-200 bg-white text-slate-400 hover:border-slate-300 dark:bg-slate-800 dark:border-slate-700"
                                )}
                            >
                                <span className="text-lg font-bold">{d}</span>
                                <span className="text-[10px]">日</span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Direct Input (Fallback) */}
            <div className="flex items-center gap-2 mt-2">
                <input
                    type="number"
                    value={value ? Math.round(value / 60 * 10) / 10 : ''}
                    onChange={(e) => onChange(Number(e.target.value) * 60)}
                    placeholder="時間(h)直接入力"
                    className="w-full bg-slate-50 dark:bg-slate-800 border-b border-slate-300 p-1 text-sm text-center outline-none focus:border-blue-500"
                />
                <span className="text-xs text-slate-400">時間(h)</span>
            </div>
        </div>
    );
};
