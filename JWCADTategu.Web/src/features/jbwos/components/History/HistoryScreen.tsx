import React, { useEffect, useState } from 'react';
import { ArrowLeft, Clock, Activity, Coffee, PlayCircle } from 'lucide-react';

// Define Log Interface corresponding to backend
interface DailyLog {
    id: string;
    date: string;
    category: string; // 'life' | 'execution'
    content: string;
    created_at: number;
}

export const HistoryScreen: React.FC<{ onBack: () => void }> = ({ onBack }) => {
    const [logs, setLogs] = useState<DailyLog[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadHistory();
    }, []);

    const loadHistory = async () => {
        setLoading(true);
        try {
            // Assume ApiClient has a generic getter or we fetch directly
            // Since repo doesn't have getHistory yet, we might need to add it or fetch raw.
            // Let's use fetch for now or expand ApiClient later.
            // Using a relative path that proxy handles or direct backend URL logic.
            const res = await fetch('/api/history');
            const data = await res.json();
            if (Array.isArray(data)) {
                setLogs(data);
            }
        } catch (e) {
            console.error('Failed to load history', e);
        } finally {
            setLoading(false);
        }
    };

    const formatTime = (ts: number) => {
        return new Date(ts * 1000).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
    };

    const getIcon = (category: string, content: string) => {
        if (category === 'execution') return <PlayCircle size={16} className="text-emerald-500" />;
        if (content.includes('routine')) return <Activity size={16} className="text-blue-400" />;
        return <Coffee size={16} className="text-amber-500" />;
    };

    return (
        <div className="h-full flex flex-col bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200">
            {/* Header */}
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center gap-4 bg-white dark:bg-slate-950">
                <button onClick={onBack} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                    <ArrowLeft size={20} />
                </button>
                <h2 className="text-lg font-bold flex items-center gap-2">
                    <Clock size={20} className="text-slate-400" />
                    History & Logs
                </h2>
            </div>

            {/* Timeline */}
            <div className="flex-1 overflow-y-auto p-4 md:p-8">
                {loading ? (
                    <div className="text-center text-slate-400 mt-20">Loading history...</div>
                ) : logs.length === 0 ? (
                    <div className="text-center text-slate-400 mt-20">No history recorded yet.</div>
                ) : (
                    <div className="max-w-2xl mx-auto relative">
                        {/* Vertical Line */}
                        <div className="absolute left-6 top-0 bottom-0 w-px bg-slate-200 dark:bg-slate-800" />

                        <div className="flex flex-col gap-6">
                            {logs.map((log) => (
                                <div key={log.id} className="relative flex gap-6 items-start group">
                                    {/* Timeline Node */}
                                    <div className="z-10 w-12 text-xs font-mono text-slate-400 text-right pt-1 bg-slate-50 dark:bg-slate-900 pr-2">
                                        {formatTime(log.created_at)}
                                    </div>

                                    {/* Content Bubble */}
                                    <div className="flex-1 bg-white dark:bg-slate-800 p-4 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 flex gap-3 items-start group-hover:border-slate-300 dark:group-hover:border-slate-600 transition-colors">
                                        <div className="mt-1">
                                            {getIcon(log.category, log.content)}
                                        </div>
                                        <div>
                                            <div className="text-sm font-medium">
                                                {log.content}
                                            </div>
                                            <div className="text-[10px] uppercase tracking-wider text-slate-400 mt-1">
                                                {log.category.toUpperCase()}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
