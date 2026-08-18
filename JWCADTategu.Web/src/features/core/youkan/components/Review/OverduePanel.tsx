import React from 'react';
import { motion } from 'framer-motion';
import { parseISO, format as formatDate } from 'date-fns';
import { Item } from '../../types';
import { OverdueGroup, OverdueItem } from '../../logic/overdueGroups';
import { formatWeekLoadHours } from '../../logic/weekLoad';
import { runSequentialUpdates } from '../../logic/sequentialUpdates';
import { SmartDateInput } from '../Inputs/SmartDateInput';

interface OverduePanelProps {
    groups: OverdueGroup[];
    today: string; // "YYYY-MM-DD"
    onUpdateItem: (id: string, updates: Partial<Item>) => void | Promise<void>;
    onClose: () => void;
}

interface ContactAttempt {
    action: 'contact' | 'uncontact';
    sending: boolean;
    done: number;
    total: number;
    failedIds: string[];
}

/**
 * R-136 / F-55: 期限超過分を得意先・案件ごとに俯瞰し、納期の再登録と
 * 「連絡した」の記録を最短にするパネル。ReviewSweep（R-127）と同じ位置・
 * 見た目の系統（右下オーバーレイ、背景暗転なし、フェード以外のアニメなし）。
 */
export const OverduePanel: React.FC<OverduePanelProps> = ({ groups, today, onUpdateItem, onClose }) => {
    React.useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    const totalCount = groups.reduce((sum, g) => sum + g.items.length, 0);
    const totalMinutes = groups.reduce((sum, g) => sum + g.totalMinutes, 0);

    // R-138: 「連絡した」のブロック一括更新。旧実装はブロック内の全アイテムに
    // onUpdateItemを並列で投げていたため、SQLite単一ライターの競合で一部が失敗していた
    // （R-121と同根）。逐次送信＋進捗表示＋失敗分だけの再試行に変更する
    const [contactAttempts, setContactAttempts] = React.useState<Record<string, ContactAttempt>>({});

    const handleToggleContacted = async (group: OverdueGroup, retryIds?: string[]) => {
        const key = group.projectId ?? '__none__';
        const previous = contactAttempts[key];
        const action: 'contact' | 'uncontact' = retryIds ? previous.action : (group.contacted ? 'uncontact' : 'contact');
        const targetIds = retryIds ?? group.items.map(item => item.id);
        const itemsById = new Map(group.items.map(item => [item.id, item]));

        setContactAttempts(prev => ({
            ...prev,
            [key]: { action, sending: true, done: 0, total: targetIds.length, failedIds: [] },
        }));

        const { failedIds } = await runSequentialUpdates(
            targetIds,
            async (itemId) => {
                const item = itemsById.get(itemId);
                const meta = { ...(item?.meta || {}) };
                if (action === 'uncontact') {
                    delete meta.contacted_at;
                } else {
                    meta.contacted_at = today;
                }
                await onUpdateItem(itemId, { meta });
            },
            (done, total) => {
                setContactAttempts(prev => ({ ...prev, [key]: { ...prev[key], done, total } }));
            }
        );

        setContactAttempts(prev => ({
            ...prev,
            [key]: { action, sending: false, done: targetIds.length, total: targetIds.length, failedIds },
        }));
    };

    // R-147: 行の締切表示（有効締切）と編集対象を一致させる。prep_date は Unix秒（DecisionDetailModal・ガントと同じ）
    const handleDeadlineChange = (item: OverdueItem, date: Date | null) => {
        if (!date) return;
        onUpdateItem(item.id, item.deadlineField === 'prep_date'
            ? { prep_date: Math.floor(date.getTime() / 1000) }
            : { due_date: formatDate(date, 'yyyy-MM-dd') });
    };

    return (
        <div
            data-testid="overdue-panel"
            className="fixed bottom-4 right-4 z-40 w-[calc(100vw-2rem)] sm:w-[420px] max-h-[70vh] pointer-events-none"
        >
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.2 }}
                className="pointer-events-auto bg-white dark:bg-slate-900 rounded-lg shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[70vh]"
            >
                <div className="flex items-center justify-between gap-2 px-4 py-3 shrink-0 border-b border-slate-100 dark:border-slate-800">
                    <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                        超過分 {totalCount}件 ／ 合計 {formatWeekLoadHours(totalMinutes)}
                    </h3>
                    <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xs shrink-0" title="閉じる (Esc)">✕</button>
                </div>

                <div className="overflow-y-auto px-4 py-3 flex flex-col gap-4">
                    {groups.map(group => (
                        <div key={group.projectId ?? '__none__'} className="flex flex-col gap-2">
                            <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                    <p className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">{group.groupTitle}</p>
                                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                        {group.items.length}件・{formatWeekLoadHours(group.totalMinutes)}・最古{group.oldestOverdueDays}日超過
                                    </p>
                                </div>
                                {group.projectId !== null && (() => {
                                    const attempt = contactAttempts[group.projectId ?? '__none__'];
                                    const label = attempt?.sending
                                        ? `${Math.min(attempt.done + 1, attempt.total)}/${attempt.total}`
                                        : attempt && attempt.failedIds.length > 0
                                            ? `${attempt.failedIds.length}件更新できませんでした`
                                            : group.contacted && group.contactedAt
                                                ? `連絡 ${formatDate(parseISO(group.contactedAt), 'M/d')}`
                                                : '連絡した';
                                    return (
                                        <button
                                            type="button"
                                            disabled={attempt?.sending}
                                            onClick={() => handleToggleContacted(group, attempt?.failedIds.length ? attempt.failedIds : undefined)}
                                            className={`px-2 py-1 rounded-md text-[11px] font-bold shrink-0 transition-colors disabled:opacity-60 ${group.contacted
                                                ? 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-300'
                                                : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                                                }`}
                                        >
                                            {label}
                                        </button>
                                    );
                                })()}
                            </div>

                            <div className="flex flex-col gap-1.5">
                                {group.items.map(item => (
                                    <div key={item.id} className="flex items-center gap-2">
                                        <span className="text-xs text-slate-700 dark:text-slate-200 truncate flex-1">{item.title}</span>
                                        <span className="text-[11px] text-slate-500 dark:text-slate-400 shrink-0">{formatWeekLoadHours(item.estimatedMinutes)}</span>
                                        <span className="text-[11px] text-slate-500 dark:text-slate-400 shrink-0 whitespace-nowrap">
                                            {formatDate(new Date(item.deadline), 'M/d')}（<span className="text-red-600 dark:text-red-400">{item.overdueDays}日超過</span>）
                                        </span>
                                        <span className="text-[10px] text-slate-400 shrink-0">{item.deadlineField === 'prep_date' ? 'マイ期限' : '納期'}</span>
                                        <div className="w-28 shrink-0">
                                            <SmartDateInput
                                                value={new Date(item.deadline)}
                                                onChange={(date) => handleDeadlineChange(item, date)}
                                                inputClassName="!h-8 !py-1 !text-xs !pl-7"
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </motion.div>
        </div>
    );
};
