import React from 'react';
import { motion } from 'framer-motion';
import { YOUKAN_KEYS } from '../../../session/youkanKeys';

interface ReviewPromptProps {
    /** 要判断キューの件数（buildReviewQueue の結果件数） */
    count: number;
    today: string; // "YYYY-MM-DD"
    onStart: () => void;
}

/**
 * R-127: 1日1回、その日最初にYoukanを開いた時だけ表示する右下の誘導カード。
 * 「今日はやめる」を押すと当日は再表示しない（localStorage）。フェードのみ、
 * 他要素をずらさない。N=0なら出さない。
 */
export const ReviewPrompt: React.FC<ReviewPromptProps> = ({ count, today, onStart }) => {
    const [hidden, setHidden] = React.useState(false);

    const dismissedToday = React.useMemo(
        () => localStorage.getItem(YOUKAN_KEYS.REVIEW_PROMPT_DISMISSED) === today,
        [today]
    );

    if (count <= 0 || dismissedToday || hidden) return null;

    const handleDismissToday = () => {
        localStorage.setItem(YOUKAN_KEYS.REVIEW_PROMPT_DISMISSED, today);
        setHidden(true);
    };

    const handleStart = () => {
        setHidden(true);
        onStart();
    };

    return (
        <motion.div
            data-testid="review-prompt"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="fixed bottom-4 right-4 z-[9997] w-[320px] bg-white dark:bg-slate-900 rounded-lg shadow-2xl border border-slate-200 dark:border-slate-800 p-4"
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
                    onClick={handleDismissToday}
                    className="px-3 py-1.5 rounded-md text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors"
                >
                    今日はやめる
                </button>
            </div>
        </motion.div>
    );
};
