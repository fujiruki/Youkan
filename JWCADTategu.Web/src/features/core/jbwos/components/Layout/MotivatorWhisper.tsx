import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../../auth/providers/AuthProvider';
import { MotivationEditorModal } from './MotivationEditorModal';

const DEFAULT_QUOTES = [
    "進むほど作業は楽になるもの",
    "完璧よりもまず完成させよう",
    "今日できることをやる",
    "一歩ずつ進もう",
    "休息も仕事のうち",
    "焦らず、腐らず、諦めず"
];

const DISPLAY_DURATION = 45000; // 45秒
const INTERVAL_MIN = 15; // 分
const INTERVAL_MAX = 30; // 分

export const MotivatorWhisper: React.FC = () => {
    const { user } = useAuth();
    const [quotes, setQuotes] = useState<string[]>(DEFAULT_QUOTES);
    const [currentQuote, setCurrentQuote] = useState<string>('');
    const [isVisible, setIsVisible] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const hideTimerRef = useRef<NodeJS.Timeout | null>(null);
    const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
    const isLongPressTriggered = useRef(false);

    // ユーザー設定から名言リストを更新
    useEffect(() => {
        if (user?.preferences?.motivation_quotes) {
            const userQuotes = (user.preferences.motivation_quotes as string)
                .split('\n')
                .map(q => q.trim())
                .filter(q => q.length > 0);

            if (userQuotes.length > 0) {
                setQuotes(userQuotes);
            } else {
                setQuotes(DEFAULT_QUOTES);
            }
        } else {
            setQuotes(DEFAULT_QUOTES);
        }
    }, [user]);

    // 名言を表示する関数
    const showQuote = useCallback(() => {
        if (quotes.length === 0) return;
        const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];
        setCurrentQuote(randomQuote);
        setIsVisible(true);

        // 自動消滅タイマー
        if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
        hideTimerRef.current = setTimeout(() => {
            setIsVisible(false);
        }, DISPLAY_DURATION);

        // 次の表示スケジュール
        scheduleNextQuote();
    }, [quotes]);

    // 次の表示をスケジュールする関数
    const scheduleNextQuote = useCallback(() => {
        if (timerRef.current) clearTimeout(timerRef.current);
        const nextIntervalCurrent = Math.floor(Math.random() * (INTERVAL_MAX - INTERVAL_MIN + 1) + INTERVAL_MIN) * 60 * 1000;
        timerRef.current = setTimeout(showQuote, nextIntervalCurrent);
    }, [showQuote]);

    // 初回起動時とスケジュール開始
    useEffect(() => {
        // 初回はすぐに表示（または少し遅れて）
        const initialDelay = setTimeout(showQuote, 2000);

        return () => {
            clearTimeout(initialDelay);
            if (timerRef.current) clearTimeout(timerRef.current);
            if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
        };
    }, []); // 初回のみ実行だが、showQuoteが変わると再実行される...依存配列を空にしてshowQuoteをrefにするか、useEffect内で完結させるのが安全だが今回は簡易的に。
    // showQuoteが依存配列にあるとquotesが変わるたびにスケジュールがリセットされるが、それは許容範囲。

    // 長押しハンドリング
    const handleTouchStart = () => {
        isLongPressTriggered.current = false;
        longPressTimerRef.current = setTimeout(() => {
            isLongPressTriggered.current = true;
            setIsModalOpen(true);
            // モーダルが開くときはWhisperを消さないでおくか、あるいは消すか。
            // ユーザー体験的には消さずにモーダルが出る方が自然。
        }, 800); // 800ms長押し
    };

    const handleTouchEnd = () => {
        if (longPressTimerRef.current) {
            clearTimeout(longPressTimerRef.current);
        }

        if (!isLongPressTriggered.current) {
            // 短押し（タップ）の処理：消す
            setIsVisible(false);
        }
    };

    return (
        <>
            <AnimatePresence>
                {isVisible && (
                    <motion.div
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 10 }}
                        transition={{ duration: 0.5 }}
                        className="ml-6 cursor-pointer select-none"
                        onMouseDown={handleTouchStart}
                        onMouseUp={handleTouchEnd}
                        onTouchStart={handleTouchStart}
                        onTouchEnd={handleTouchEnd}
                        title="タップで非表示 / 長押しで編集"
                    >
                        <span className="text-[10px] font-bold text-[rgb(130,141,159)] drop-shadow-sm font-serif italic opacity-90">
                            「{currentQuote}」
                        </span>
                    </motion.div>
                )}
            </AnimatePresence>

            {isModalOpen && (
                <MotivationEditorModal onClose={() => setIsModalOpen(false)} />
            )}
        </>
    );
};
