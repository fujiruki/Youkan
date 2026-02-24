import React, { useEffect, useState } from 'react';
import { LogService } from '../services/LogService';
import { DailyLog } from '../types';

import { ArrowLeft } from 'lucide-react';

export const HistoryScreen: React.FC<{ onBack: () => void }> = ({ onBack }) => {
    const [timeline, setTimeline] = useState<DailyLog[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            try {
                const data = await LogService.getHistoryTimeline(100);
                setTimeline(data);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    // Helper to group by date
    const grouped = timeline.reduce((acc, log) => {
        const date = log.date;
        if (!acc[date]) acc[date] = [];
        acc[date].push(log);
        return acc;
    }, {} as Record<string, DailyLog[]>);

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-8 pb-24">
            <div className="flex items-center gap-4 mb-8">
                <button
                    onClick={onBack}
                    className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors"
                >
                    <ArrowLeft className="w-6 h-6 text-slate-600 dark:text-slate-400" />
                </button>
                <h1 className="text-3xl font-light text-slate-800 dark:text-slate-100 tracking-tight">
                    History & Logs
                </h1>
            </div>

            {loading ? (
                <div className="text-slate-400">Loading...</div>
            ) : (
                <div className="space-y-12 animate-fade-in">
                    {Object.entries(grouped).map(([date, logs]) => (
                        <div key={date} className="relative pl-8 border-l-2 border-slate-200 dark:border-slate-800">
                            <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-slate-300 dark:bg-slate-700 border-4 border-slate-50 dark:border-slate-900" />
                            <h2 className="text-lg font-bold text-slate-600 dark:text-slate-400 mb-4">{date}</h2>
                            <div className="space-y-4">
                                {logs.map(log => (
                                    <div key={log.id} className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 flex items-start justify-between hover:shadow-md transition-shadow">
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${log.category === 'execution' ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300' : 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300'}`}>
                                                    {log.category}
                                                </span>
                                                {log.projectTitle && (
                                                    <span className="flex items-center gap-1 text-xs text-slate-500">
                                                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: log.projectColor || '#ccc' }} />
                                                        {log.projectTitle}
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-slate-800 dark:text-slate-200 font-medium">
                                                {log.content}
                                            </p>
                                        </div>
                                        {log.durationMinutes ? (
                                            <div className="flex flex-col items-end text-right">
                                                <span className="text-lg font-bold text-slate-700 dark:text-slate-300 font-mono">
                                                    {log.durationMinutes}<span className="text-xs text-slate-400">min</span>
                                                </span>
                                            </div>
                                        ) : null}
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
