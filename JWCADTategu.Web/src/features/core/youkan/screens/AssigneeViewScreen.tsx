import React from 'react';
import { ArrowLeft, ListChecks } from 'lucide-react';
import { useAssigneeView } from '../hooks/useAssigneeView';
import { Item } from '../types';

interface AssigneeViewScreenProps {
    onBack: () => void;
}

export const AssigneeViewScreen: React.FC<AssigneeViewScreenProps> = ({ onBack }) => {
    const {
        loading,
        error,
        isAdmin,
        candidates,
        selectedAssignedTo,
        selectedCandidate,
        selectAssignee,
        buckets,
        todayMinutes,
        capacityMinutes,
        statusSummary,
    } = useAssigneeView();

    const displayName = selectedCandidate?.name || '自分';
    const ratioPercent = capacityMinutes && capacityMinutes > 0
        ? Math.round((todayMinutes / capacityMinutes) * 100)
        : null;

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-8 pb-24">
            <div className="flex items-center gap-4 mb-6">
                <button
                    onClick={onBack}
                    className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors"
                >
                    <ArrowLeft className="w-6 h-6 text-slate-600 dark:text-slate-400" />
                </button>
                <div className="flex items-center gap-3">
                    <ListChecks className="w-8 h-8 text-slate-500" />
                    <h1 className="text-3xl font-light text-slate-800 dark:text-slate-100 tracking-tight">
                        担当者別ビュー
                    </h1>
                </div>
            </div>

            {isAdmin ? (
                <div className="flex flex-wrap gap-2 mb-6">
                    {candidates.map(c => (
                        <button
                            key={c.id}
                            onClick={() => selectAssignee(c.id)}
                            className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${c.id === selectedAssignedTo
                                ? 'bg-indigo-600 text-white border-indigo-600'
                                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                                }`}
                        >
                            {c.name}
                        </button>
                    ))}
                </div>
            ) : (
                <div className="mb-6 text-sm font-medium text-slate-500 dark:text-slate-400">{displayName}</div>
            )}

            {loading ? (
                <div className="text-slate-400 text-center py-20">Loading...</div>
            ) : error ? (
                <div className="text-red-500 text-center py-20">{error}</div>
            ) : (
                <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-6">
                    <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-4">{displayName}</h2>

                    <div className="flex flex-wrap gap-8 mb-6">
                        <SummaryStat
                            label="今日の所要時間"
                            value={
                                ratioPercent !== null
                                    ? `${todayMinutes} / ${capacityMinutes}分（${ratioPercent}%）`
                                    : `${todayMinutes}分`
                            }
                        />
                        <SummaryStat label="未完了" value={String(statusSummary.incomplete)} />
                        <SummaryStat label="詰まり" value={String(statusSummary.stuck)} valueClassName="text-red-500" />
                        <SummaryStat label="待ち" value={String(statusSummary.waiting)} valueClassName="text-amber-500" />
                    </div>

                    <AssigneeViewBucketSection title="今日" items={buckets.today} />
                    <AssigneeViewBucketSection title="明日" items={buckets.tomorrow} />
                    <AssigneeViewBucketSection title="今週" items={buckets.thisWeek} />
                </div>
            )}
        </div>
    );
};

const SummaryStat: React.FC<{ label: string; value: string; valueClassName?: string }> = ({ label, value, valueClassName }) => (
    <div>
        <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">{label}</div>
        <div className={`text-lg font-mono font-bold text-slate-700 dark:text-slate-200 ${valueClassName || ''}`}>{value}</div>
    </div>
);

const AssigneeViewBucketSection: React.FC<{ title: string; items: Item[] }> = ({ title, items }) => (
    <div className="mb-6 last:mb-0">
        <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400 mb-2">{title}</h3>
        {items.length === 0 ? (
            <div className="text-xs text-slate-300 dark:text-slate-600 pl-2">なし</div>
        ) : (
            <ul className="space-y-1.5">
                {items.map(item => (
                    <li
                        key={item.id}
                        className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800"
                    >
                        <span className="flex items-center gap-2 min-w-0">
                            {item.projectTitle && (
                                <span className="shrink-0 text-xs text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
                                    {item.projectTitle}
                                </span>
                            )}
                            <span className="truncate text-sm text-slate-700 dark:text-slate-200">{item.title}</span>
                        </span>
                        {item.estimatedMinutes !== undefined && (
                            <span className="shrink-0 text-xs font-mono text-slate-400">{item.estimatedMinutes}分</span>
                        )}
                    </li>
                ))}
            </ul>
        )}
    </div>
);
