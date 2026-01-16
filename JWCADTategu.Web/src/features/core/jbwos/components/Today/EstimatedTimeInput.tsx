import React, { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';
import { cn } from '../../../../../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { DefaultEstimationSettings } from '../../../../../features/plugins/tategu/domain/EstimationSettings';

interface Props {
    value: number; // minutes
    onChange: (val: number) => void;
    className?: string;
}

export const EstimatedTimeInput: React.FC<Props> = ({ value, onChange, className }) => {
    // 1. Determine "Hours per Day" (Context)
    const getHoursPerDay = () => {
        try {
            const saved = localStorage.getItem('globalEstimationSettings');
            if (saved) return JSON.parse(saved).hoursPerDay || 7;
        } catch (e) { }
        return DefaultEstimationSettings.hoursPerDay || 7;
    };
    const hoursPerDay = getHoursPerDay();

    // 2. Determine Mode based on current value (Auto-switch on load)
    const [mode, setMode] = useState<'hours' | 'days'>('hours');

    useEffect(() => {
        if (value >= hoursPerDay * 60) {
            setMode('days');
        } else {
            setMode('hours');
        }
    }, []); // Only on mount/init (user can switch manually later)

    // Data for Selections
    const hourOptions = [
        { label: '30m', mins: 30 },
        { label: '1h', mins: 60 },
        { label: '1.5h', mins: 90 },
        { label: '2h', mins: 120 },
        { label: '3h', mins: 180 },
        { label: '4h', mins: 240 },
        { label: '5h', mins: 300 },
        { label: '6h', mins: 360 }, // Almost a day
    ];

    const dayOptions = Array.from({ length: 14 }, (_, i) => i + 1); // 1 to 14 days

    // Visual Bar Calculation
    // Max width reference: 5 days = 100%? Or 3 days?
    // Let's make it dynamic.
    // Hours mode: Max 8h = 100%
    // Days mode: Max 5d = 100% (or 10d)
    const getBarPercentage = () => {
        if (!value) return 0;
        if (mode === 'hours') {
            const max = hoursPerDay * 60; // Full day work
            return Math.min((value / max) * 100, 100);
        } else {
            const max = 5 * hoursPerDay * 60; // 5 days week
            return Math.min((value / max) * 100, 100);
        }
    };

    const handleDaySelect = (d: number) => {
        onChange(d * hoursPerDay * 60);
    };

    const formatValue = (v: number) => {
        if (!v) return '未設定';
        if (v < hoursPerDay * 60) {
            const h = v / 60;
            return `${Math.round(h * 10) / 10}時間`;
        } else {
            const d = v / (hoursPerDay * 60);
            return `${Math.round(d * 10) / 10}日 (${Math.round(v / 60)}h)`;
        }
    };

    return (
        <div className={cn("space-y-4", className)}>
            {/* Header: Label + Value + Mode Toggles */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Clock size={16} className="text-slate-400" />
                    <span className="text-sm font-bold text-slate-600 dark:text-slate-300">
                        制作目安 (Weight)
                    </span>
                </div>

                {/* Mode Toggle Pills */}
                <div className="flex bg-slate-100 dark:bg-slate-800 rounded-full p-1">
                    <button
                        onClick={() => setMode('hours')}
                        className={cn(
                            "px-3 py-1 text-xs font-bold rounded-full transition-all",
                            mode === 'hours'
                                ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-sm"
                                : "text-slate-400 hover:text-slate-600"
                        )}
                    >
                        時間 (Spot)
                    </button>
                    <button
                        onClick={() => setMode('days')}
                        className={cn(
                            "px-3 py-1 text-xs font-bold rounded-full transition-all",
                            mode === 'days'
                                ? "bg-white dark:bg-slate-700 text-amber-600 dark:text-amber-300 shadow-sm"
                                : "text-slate-400 hover:text-slate-600"
                        )}
                    >
                        日数 (Span)
                    </button>
                </div>
            </div>

            {/* Visual Bar (The "Physicality") */}
            <div className="relative h-6 bg-slate-100 dark:bg-slate-800 rounded-lg overflow-hidden w-full shadow-inner">
                {/* Background grid lines for context? (Optional) */}
                <div className="absolute inset-0 flex">
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className="flex-1 border-r border-slate-200 dark:border-slate-700/50" />
                    ))}
                </div>

                <motion.div
                    className={cn(
                        "h-full relative",
                        mode === 'hours' ? "bg-gradient-to-r from-indigo-300 to-indigo-500" : "bg-gradient-to-r from-amber-300 to-amber-500"
                    )}
                    initial={{ width: 0 }}
                    animate={{ width: `${getBarPercentage()}%` }}
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                >
                    {/* Shine effect */}
                    <div className="absolute top-0 right-0 bottom-0 w-[1px] bg-white/50 shadow-[0_0_10px_rgba(255,255,255,0.8)]" />
                </motion.div>

                {/* Value Text Overlay */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <span className="text-xs font-bold text-slate-600 dark:text-slate-300 drop-shadow-sm bg-white/40 px-2 rounded backdrop-blur-[1px]">
                        {formatValue(value)}
                    </span>
                </div>
            </div>

            {/* Selection Area (Contextual) */}
            <div>
                <AnimatePresence mode="wait">
                    {mode === 'hours' ? (
                        <motion.div
                            key="hours"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="grid grid-cols-4 gap-2"
                        >
                            {hourOptions.map(opt => (
                                <button
                                    key={opt.mins}
                                    onClick={() => onChange(opt.mins)}
                                    className={cn(
                                        "py-2 rounded-lg text-sm font-bold border transition-all active:scale-95",
                                        value === opt.mins
                                            ? "border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 shadow-md ring-1 ring-indigo-200"
                                            : "border-slate-200 bg-white text-slate-500 hover:border-indigo-300 dark:bg-slate-800 dark:border-slate-700"
                                    )}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </motion.div>
                    ) : (
                        <motion.div
                            key="days"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                        >
                            <div className="text-xs text-slate-400 mb-2 text-center">
                                1日 = {hoursPerDay}時間換算
                            </div>
                            <div className="flex overflow-x-auto gap-2 pb-2 scrollbar-thin scrollbar-thumb-amber-200 scrollbar-track-transparent snap-x p-1">
                                {dayOptions.map(d => {
                                    const mins = d * hoursPerDay * 60;
                                    const isSelected = Math.abs(value - mins) < 30; // 30min tolerance
                                    return (
                                        <button
                                            key={d}
                                            onClick={() => handleDaySelect(d)}
                                            className={cn(
                                                "snap-start shrink-0 w-14 h-14 rounded-xl border-2 flex flex-col items-center justify-center transition-all active:scale-95",
                                                isSelected
                                                    ? "border-amber-500 bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-200 shadow-md ring-1 ring-amber-200"
                                                    : "border-slate-200 bg-white text-slate-400 hover:border-amber-300 dark:bg-slate-800 dark:border-slate-700"
                                            )}
                                        >
                                            <span className="text-lg font-bold">{d}</span>
                                            <span className="text-[10px]">日</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Fine Tune Input (Footer) */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2">
                <span className="text-xs text-slate-400">微調整:</span>
                <input
                    type="number"
                    value={value ? Math.round(value / 60 * 10) / 10 : ''}
                    onChange={(e) => onChange(Number(e.target.value) * 60)}
                    className="w-20 text-right bg-transparent border-b border-slate-300 text-sm font-mono focus:border-indigo-500 outline-none"
                    placeholder="0.0"
                />
                <span className="text-xs text-slate-500">h</span>
            </div>
        </div>
    );
};
