import React from 'react';
import { motion } from 'framer-motion';
import { YOUKAN_KEYS, YOUKAN_EVENTS } from '../../../session/youkanKeys';

interface ReviewPromptProps {
    /** 要判断キューの件数（buildReviewQueue の結果件数） */
    count: number;
    today: string; // "YYYY-MM-DD"
    onStart: () => void;
}

const SNOOZE_DURATION_MS = 60 * 60 * 1000;

const readSnoozeUntil = (): number | null => {
    const raw = localStorage.getItem(YOUKAN_KEYS.REVIEW_PROMPT_SNOOZE_UNTIL);
    const parsed = raw ? Number(raw) : NaN;
    return Number.isFinite(parsed) && parsed > Date.now() ? parsed : null;
};

// R-134: 通知許可は「後で」を初めて押した時に1回だけ要求する
const requestNotificationPermissionOnce = () => {
    if (typeof Notification === 'undefined') return;
    if (localStorage.getItem(YOUKAN_KEYS.REVIEW_NOTIFY_ASKED)) return;
    localStorage.setItem(YOUKAN_KEYS.REVIEW_NOTIFY_ASKED, '1');
    Notification.requestPermission();
};

const notifySnoozeExpired = (count: number) => {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    const notification = new Notification(`後でと言っていた要判断 ${count}件、今は？`);
    notification.onclick = () => {
        window.focus();
        sessionStorage.setItem(YOUKAN_KEYS.REVIEW_SWEEP_PENDING, '1');
        window.dispatchEvent(new CustomEvent(YOUKAN_EVENTS.OPEN_REVIEW_SWEEP));
    };
};

/**
 * R-127: 1日1回、その日最初にYoukanを開いた時だけ表示する右下の誘導カード。
 * 「今日はやめる」を押すと当日は再表示しない（localStorage）。フェードのみ、
 * 他要素をずらさない。N=0なら出さない。
 * R-134: 「後で（1時間後）」で60分間だけスヌーズし、経過後に再表示・通知する。
 */
export const ReviewPrompt: React.FC<ReviewPromptProps> = ({ count, today, onStart }) => {
    const [dismissed, setDismissed] = React.useState(false);
    const [snoozeUntil, setSnoozeUntil] = React.useState<number | null>(readSnoozeUntil);
    const countRef = React.useRef(count);

    React.useEffect(() => {
        countRef.current = count;
    }, [count]);

    const dismissedToday = React.useMemo(
        () => localStorage.getItem(YOUKAN_KEYS.REVIEW_PROMPT_DISMISSED) === today,
        [today]
    );

    React.useEffect(() => {
        if (!snoozeUntil) return;
        const delay = Math.max(snoozeUntil - Date.now(), 0);
        const timer = window.setTimeout(() => {
            localStorage.removeItem(YOUKAN_KEYS.REVIEW_PROMPT_SNOOZE_UNTIL);
            setSnoozeUntil(null);
            notifySnoozeExpired(countRef.current);
        }, delay);
        return () => window.clearTimeout(timer);
    }, [snoozeUntil]);

    if (count <= 0 || dismissedToday || dismissed || snoozeUntil) return null;

    const handleDismissToday = () => {
        localStorage.setItem(YOUKAN_KEYS.REVIEW_PROMPT_DISMISSED, today);
        setDismissed(true);
    };

    const handleStart = () => {
        setDismissed(true);
        onStart();
    };

    const handleSnooze = () => {
        const until = Date.now() + SNOOZE_DURATION_MS;
        localStorage.setItem(YOUKAN_KEYS.REVIEW_PROMPT_SNOOZE_UNTIL, String(until));
        requestNotificationPermissionOnce();
        setSnoozeUntil(until);
    };

    return (
        <motion.div
            data-testid="review-prompt"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="fixed bottom-4 right-4 z-40 w-[320px] bg-white dark:bg-slate-900 rounded-lg shadow-2xl border border-slate-200 dark:border-slate-800 p-4"
        >
            <p className="text-sm text-slate-700 dark:text-slate-200">
                要判断 {count}件。3件だけ、1分で捌く？
            </p>
            <div className="flex gap-2 mt-3">
                <button
                    type="button"
                    onClick={handleStart}
                    className="px-3 py-1.5 rounded-md text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white transition-colors"
                >
                    はじめる
                </button>
                <button
                    type="button"
                    onClick={handleSnooze}
                    className="px-3 py-1.5 rounded-md text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors"
                >
                    後で（1時間後）
                </button>
                <button
                    type="button"
                    onClick={handleDismissToday}
                    className="px-3 py-1.5 rounded-md text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors"
                >
                    今日はやめる
                </button>
            </div>
        </motion.div>
    );
};
