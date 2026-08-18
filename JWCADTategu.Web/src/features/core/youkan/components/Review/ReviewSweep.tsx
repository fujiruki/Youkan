import React from 'react';
import { motion } from 'framer-motion';
import { addDays, differenceInCalendarDays, parseISO } from 'date-fns';
import { Item } from '../../types';
import { Decision } from '../../logic/decisionResolution';
import { isReviewDue } from '../../logic/statusUtils';
import { getEffectiveDeadline } from '../../logic/flowAutoPlace';
import { safeFormat } from '../../logic/dateUtils';
import { SmartDateInput } from '../Inputs/SmartDateInput';

interface ReviewSweepProps {
    /** buildReviewQueue(items, today) の結果（対象判定・並びは呼び出し側で完了済み） */
    items: Item[];
    today: string; // "YYYY-MM-DD"
    judgmentPhrases: string[];
    declinedThisWeek: number;
    onDecision: (id: string, decision: Decision, note: string | undefined, updates: Partial<Item> | undefined) => void | Promise<void>;
    onOpenDetail: (item: Item) => void;
    onClose: () => void;
}

const SESSION_LIMIT = 3;

/**
 * R-127: 要判断キュー「捌く」の軽量カード。画面右下のオーバーレイ、モーダルではない。
 * 1件ずつ表示し、判断は必ず decisionToStatus 経由（呼び出し側の onDecision に委譲）。
 * 3件判断したら完了ビューで止まる。アニメーションはフェードのみ（動き回らない）。
 */
export const ReviewSweep: React.FC<ReviewSweepProps> = ({
    items,
    today,
    judgmentPhrases,
    declinedThisWeek,
    onDecision,
    onOpenDetail,
    onClose,
}) => {
    // R-127: セッション内で「もう出さない」アイテム。
    // 親から渡される items は resolveDecision 後の再取得が完了するまで更新されない
    // ことがあるため、判断直後も同じアイテムが再表示されないようローカルで除外する。
    // judgedIds は判断済み（このセッション中は復活しない）、skippedIds は「飛ばした」
    // （「あと3件」で再度対象に戻る）で区別する。
    const [judgedIds, setJudgedIds] = React.useState<Set<string>>(new Set());
    const [skippedIds, setSkippedIds] = React.useState<Set<string>>(new Set());
    const [judgedCount, setJudgedCount] = React.useState(0);
    const [phraseIndex, setPhraseIndex] = React.useState(-1);
    const [laterDate, setLaterDate] = React.useState<Date | null>(() => addDays(parseISO(today), 7));

    const visibleQueue = React.useMemo(
        () => items.filter(i => !judgedIds.has(i.id) && !skippedIds.has(i.id)),
        [items, judgedIds, skippedIds]
    );
    const current = visibleQueue[0] || null;
    const isDone = judgedCount >= SESSION_LIMIT || (judgedCount > 0 && visibleQueue.length === 0);

    React.useEffect(() => {
        setPhraseIndex(i => i + 1);
        setLaterDate(addDays(parseISO(today), 7));
    }, [current?.id, today]);

    React.useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                onClose();
                return;
            }
            if (isDone || !current) return;

            const target = e.target as HTMLElement | null;
            const isTyping = !!target && (
                target.tagName === 'INPUT' ||
                target.tagName === 'TEXTAREA' ||
                target.isContentEditable
            );
            if (isTyping) return;

            if (e.key === '1') { e.preventDefault(); handleYes(); }
            if (e.key === '2') { e.preventDefault(); handleLater(); }
            if (e.key === '3') { e.preventDefault(); handleNo(); }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [current, isDone, laterDate, onClose]);

    const markJudged = (id: string) => {
        setJudgedIds(prev => new Set(prev).add(id));
        setJudgedCount(c => c + 1);
    };

    const handleYes = () => {
        if (!current) return;
        onDecision(current.id, 'yes', undefined, undefined);
        markJudged(current.id);
    };

    const handleLater = () => {
        if (!current) return;
        const prep_date = laterDate ? Math.floor(laterDate.getTime() / 1000) : undefined;
        onDecision(current.id, 'later', undefined, prep_date !== undefined ? { prep_date } : undefined);
        markJudged(current.id);
    };

    const handleNo = () => {
        if (!current) return;
        onDecision(current.id, 'no', undefined, { meta: { ...(current.meta || {}), declined: true } });
        markJudged(current.id);
    };

    const handleSkip = () => {
        if (!current) return;
        setSkippedIds(prev => new Set(prev).add(current.id));
    };

    const handleRestart = () => {
        setJudgedCount(0);
        setSkippedIds(new Set());
    };

    if (!current && judgedCount === 0) return null;

    const phrase = judgmentPhrases.length > 0
        ? judgmentPhrases[((phraseIndex % judgmentPhrases.length) + judgmentPhrases.length) % judgmentPhrases.length]
        : null;

    const deadlineMs = current ? getEffectiveDeadline(current) : null;
    const reviewDue = current ? isReviewDue(current, today) : false;
    const overdueDays = deadlineMs !== null ? differenceInCalendarDays(parseISO(today), new Date(deadlineMs)) : null;

    return (
        <div
            data-testid="review-sweep"
            className="fixed bottom-4 right-4 z-40 w-[340px] pointer-events-none"
        >
            {isDone ? (
                    <motion.div
                        key="done"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.2 }}
                        className="pointer-events-auto bg-white dark:bg-slate-900 rounded-lg shadow-2xl border border-slate-200 dark:border-slate-800 p-4"
                    >
                        <p className="text-sm font-bold text-slate-800 dark:text-slate-100">今日はここまで。</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                            残り {visibleQueue.length} 件 ／ 今週 断った {declinedThisWeek} 件
                        </p>
                        <div className="flex gap-2 mt-3">
                            {visibleQueue.length > 0 && (
                                <button
                                    type="button"
                                    onClick={handleRestart}
                                    className="px-3 py-1.5 rounded-md text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white transition-colors"
                                >
                                    あと3件
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-3 py-1.5 rounded-md text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors"
                            >
                                閉じる
                            </button>
                        </div>
                    </motion.div>
                ) : current ? (
                    <motion.div
                        key={current.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.2 }}
                        className="pointer-events-auto bg-white dark:bg-slate-900 rounded-lg shadow-2xl border border-slate-200 dark:border-slate-800 p-4"
                    >
                        <div className="flex items-start justify-between gap-2">
                            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">{current.title}</h3>
                            <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xs shrink-0" title="閉じる (Esc)">✕</button>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                            {current.projectTitle && <span>{current.projectTitle}　</span>}
                            {reviewDue && current.reviewDate ? (
                                <span>再確認 {safeFormat(current.reviewDate, 'M/d')}</span>
                            ) : overdueDays !== null && overdueDays > 0 ? (
                                <span>{overdueDays}日超過</span>
                            ) : null}
                            {typeof current.estimatedMinutes === 'number' && (
                                <span>　目安 {current.estimatedMinutes}分</span>
                            )}
                        </p>
                        {phrase && (
                            <p data-testid="review-sweep-phrase" className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 italic">
                                {phrase}
                            </p>
                        )}
                        <div className="flex flex-wrap items-center gap-1.5 mt-3">
                            <button
                                type="button"
                                onClick={handleYes}
                                className="px-2.5 py-1.5 rounded-md text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white transition-colors"
                            >
                                [1] 今日やる
                            </button>
                            <button
                                type="button"
                                onClick={handleLater}
                                className="px-2.5 py-1.5 rounded-md text-xs font-bold bg-teal-600 hover:bg-teal-700 text-white transition-colors"
                            >
                                [2] 後日
                            </button>
                            <div className="w-28">
                                <SmartDateInput
                                    value={laterDate}
                                    onChange={setLaterDate}
                                    inputClassName="!h-8 !py-1 !text-xs !pl-7"
                                />
                            </div>
                            <button
                                type="button"
                                onClick={handleNo}
                                className="px-2.5 py-1.5 rounded-md text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white transition-colors"
                            >
                                [3] 断った
                            </button>
                            <button
                                type="button"
                                onClick={handleSkip}
                                className="px-2.5 py-1.5 rounded-md text-xs font-bold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
                            >
                                飛ばす
                            </button>
                            <button
                                type="button"
                                onClick={() => onOpenDetail(current)}
                                className="px-2.5 py-1.5 rounded-md text-xs font-bold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 underline transition-colors"
                            >
                                詳細を開く
                            </button>
                        </div>
                    </motion.div>
                ) : null}
        </div>
    );
};
