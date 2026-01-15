
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useJBWOSViewModel } from '../jbwos/viewmodels/useJBWOSViewModel';
import { getDailyCapacity, isHoliday } from '../jbwos/logic/capacity';
import { format, addDays } from 'date-fns';
import { ja } from 'date-fns/locale';
import { ArrowLeft, Sun, Coffee, Briefcase, Calendar as CalendarIcon } from 'lucide-react';

interface FutureBoardProps {
    onClose: () => void;
}

export const FutureBoard: React.FC<FutureBoardProps> = ({ onClose }) => {
    const vm = useJBWOSViewModel();
    const [targetDate, setTargetDate] = useState<Date>(addDays(new Date(), 1)); // Default: Tomorrow

    const capacityMinutes = getDailyCapacity(targetDate, vm.capacityConfig);
    const isHolidayDay = isHoliday(targetDate, vm.capacityConfig);
    const dateLabel = format(targetDate, 'M月d日 (E)', { locale: ja });

    // Mock Data for Phase 1
    const fixedEvents = [
        { id: 'f1', title: '現場取付（A邸）', time: '09:00', duration: 180, type: 'fixed' }
    ];
    const plannedTasks = [
        { id: 'p1', title: '建具A製作', duration: 120 },
        { id: 'p2', title: '材料発注', duration: 30 }
    ];

    const plannedMinutes = plannedTasks.reduce((acc, t) => acc + t.duration, 0) + fixedEvents.reduce((acc, e) => acc + e.duration, 0);
    const remainingMinutes = Math.max(0, capacityMinutes - plannedMinutes);
    const loadPercent = Math.min(100, (plannedMinutes / (capacityMinutes || 1)) * 100); // Avoid div by 0

    return (
        <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed inset-0 bg-slate-100 dark:bg-slate-900 z-50 flex flex-col"
        >
            {/* Header */}
            <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 py-3 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-3">
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full">
                        <ArrowLeft className="text-slate-500" />
                    </button>
                    <div>
                        <h1 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                            <Sun className="text-amber-500" size={20} />
                            Tomorrow Planning
                        </h1>
                        <p className="text-xs text-slate-500">明日への架け橋をかけましょう</p>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <div className="text-right">
                        <div className="text-sm font-bold text-slate-700 dark:text-slate-300">{dateLabel}</div>
                        <div className="text-xs text-slate-500">
                            {isHolidayDay ? <span className="text-red-500 font-bold flex items-center gap-1 justify-end"><Coffee size={10} /> 休業日</span> : '稼働日'}
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content (2 Pane) */}
            <div className="flex-1 overflow-hidden flex flex-col md:flex-row">

                {/* Left: Stock (Inbox & Leftovers) */}
                <div className="w-full md:w-1/3 bg-slate-50 dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800 flex flex-col">
                    <div className="p-3 bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 font-bold text-slate-600 text-sm flex justify-between">
                        <span>Stock (未配置)</span>
                        <span className="text-xs font-normal bg-slate-200 px-2 py-0.5 rounded-full">12 items</span>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 space-y-2">
                        {/* Mock Items */}
                        {[1, 2, 3].map(i => (
                            <div key={i} className="p-3 bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 hover:border-amber-400 cursor-move transition-colors group">
                                <div className="text-sm font-medium text-slate-700 dark:text-slate-200">未完了タスク {i}</div>
                                <div className="text-xs text-slate-400 mt-1 flex justify-between">
                                    <span>Inbox</span>
                                    <span className="opacity-0 group-hover:opacity-100 text-amber-500">明日へ →</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Right: Tomorrow Timeline / List */}
                <div className="flex-1 bg-white dark:bg-slate-900 flex flex-col relative">
                    {/* Capacity Bar */}
                    <div className="absolute top-0 left-0 right-0 h-1 bg-slate-100">
                        <motion.div
                            className={`h-full ${isHolidayDay ? 'bg-red-300' : loadPercent > 100 ? 'bg-red-500' : 'bg-green-500'}`}
                            initial={{ width: 0 }}
                            animate={{ width: `${loadPercent}%` }}
                        />
                    </div>

                    <div className="p-4 flex-1 overflow-y-auto">
                        {/* Fixed Events (Big Rocks) */}
                        <div className="mb-6">
                            <h3 className="text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider flex items-center gap-2">
                                <Briefcase size={12} /> Fixed Schedule (背骨)
                            </h3>
                            <div className="space-y-2">
                                {fixedEvents.map(e => (
                                    <div key={e.id} className="p-3 bg-slate-50 dark:bg-slate-800 rounded border-l-4 border-slate-400 flex justify-between items-center opacity-70">
                                        <div className="font-bold text-slate-700 dark:text-slate-300">{e.title}</div>
                                        <div className="text-xs font-mono text-slate-500">{e.time} ({e.duration}m)</div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Planned Tasks (Floating) */}
                        <div>
                            <h3 className="text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider flex items-center gap-2">
                                <CalendarIcon size={12} /> Planned Tasks (予定)
                            </h3>
                            {isHolidayDay ? (
                                <div className="p-8 text-center text-slate-400 bg-slate-50 dark:bg-slate-800 rounded-xl border border-dashed border-slate-300">
                                    <Coffee className="mx-auto mb-2 text-slate-300" size={32} />
                                    <p>休業日設定になっています</p>
                                    <button className="mt-4 text-xs text-amber-500 hover:underline">稼働する (例外設定)</button>
                                </div>
                            ) : (
                                <div className="space-y-2 min-h-[200px] border-2 border-dashed border-slate-100 rounded-xl p-2 transition-colors hover:border-amber-100">
                                    {plannedTasks.map(t => (
                                        <div key={t.id} className="p-3 bg-white dark:bg-slate-800 rounded shadow-sm border-l-4 border-amber-400 flex justify-between items-center">
                                            <div className="font-medium text-slate-700 dark:text-slate-200">{t.title}</div>
                                            <div className="text-xs text-slate-400">{t.duration}m</div>
                                        </div>
                                    ))}
                                    <div className="p-4 text-center text-xs text-slate-400">
                                        ここへタスクをドロップ
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Stats Footer */}
                    <div className="bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 p-3 flex justify-between items-center text-xs">
                        <div className="flex gap-4">
                            <span>目安合計: <strong>{Math.round(plannedMinutes / 60 * 10) / 10}h</strong></span>
                            <span>稼働枠: <strong>{Math.round(capacityMinutes / 60 * 10) / 10}h</strong></span>
                        </div>
                        <div className={`${remainingMinutes < 0 ? 'text-red-500 font-bold' : 'text-slate-500'}`}>
                            残り: {remainingMinutes < 0 ? `オーバー ${Math.abs(remainingMinutes)}m` : `${remainingMinutes}m`}
                        </div>
                    </div>
                </div>
            </div>
        </motion.div>
    );
};
