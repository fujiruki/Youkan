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

// Config
const INITIAL_DELAY = 500; // 0.5秒後に表示開始
const FADE_DURATION = 0.5; // 0.5秒かけてフェードイン
const REMINDER_INTERVAL = 10 * 60 * 1000; // 10分
const GLOW_DURATION = 60 * 1000; // 1分間光る

export const MotivatorWhisper: React.FC = () => {
    const { user } = useAuth();
    const [quotes, setQuotes] = useState<string[]>(DEFAULT_QUOTES);
    const [currentQuote, setCurrentQuote] = useState<string>('');
    const [isVisible, setIsVisible] = useState(false);
    const [isGlowing, setIsGlowing] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const reminderTimerRef = useRef<NodeJS.Timeout | null>(null);
    const glowOffTimerRef = useRef<NodeJS.Timeout | null>(null);
    const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
    const isLongPressTriggered = useRef(false);

    // 1. Load User Preferences
    useEffect(() => {
        if (user?.preferences) {
            console.log('[MotivatorWhisper] User preferences found:', user.preferences);

            let prefs: any = {};
            try {
                prefs = typeof user.preferences === 'string'
                    ? JSON.parse(user.preferences)
                    : user.preferences;
            } catch (e) {
                console.error('[MotivatorWhisper] Failed to parse preferences:', e);
            }

            if (prefs && prefs.motivation_quotes) {
                console.log('[MotivatorWhisper] Motivation quotes found:', prefs.motivation_quotes);
                const userQuotes = (prefs.motivation_quotes as string)
                    .split('\n')
                    .map(q => q.trim())
                    .filter(q => q.length > 0);

                console.log('[MotivatorWhisper] Parsed user quotes:', userQuotes);

                if (userQuotes.length > 0) {
                    setQuotes(userQuotes);
                    return; // Successfully set user quotes
                }
            }
        }

        console.log('[MotivatorWhisper] Using default quotes.');
        setQuotes(DEFAULT_QUOTES);
    }, [user]);

    // Helper: Select a random quote
    const selectRandomQuote = useCallback(() => {
        if (quotes.length === 0) return;

        // 30% chance to pick from top 3, 70% chance to pick from all
        // (Only if there are at least 3 quotes to make the choice meaningful)
        const isPriorityPick = Math.random() < 0.3 && quotes.length >= 3;

        if (isPriorityPick) {
            const topQuotes = quotes.slice(0, 3);
            const randomQuote = topQuotes[Math.floor(Math.random() * topQuotes.length)];
            setCurrentQuote(randomQuote);
        } else {
            const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];
            setCurrentQuote(randomQuote);
        }
    }, [quotes]);

    // 2. Initial Display Logic
    useEffect(() => {
        // コンポーネントマウント時に名言を選定
        selectRandomQuote();

        // 0.5秒後に表示
        const timer = setTimeout(() => {
            setIsVisible(true);
        }, INITIAL_DELAY);

        // 10分ごとのリマインダー開始
        startReminderLoop();

        return () => {
            clearTimeout(timer);
            stopReminderLoop();
        };
    }, [selectRandomQuote]);

    // 3. Reminder Logic (Cyclic)
    const startReminderLoop = () => {
        if (reminderTimerRef.current) clearInterval(reminderTimerRef.current);

        reminderTimerRef.current = setInterval(() => {
            triggerReminder();
        }, REMINDER_INTERVAL);
    };

    const stopReminderLoop = () => {
        if (reminderTimerRef.current) clearInterval(reminderTimerRef.current);
        if (glowOffTimerRef.current) clearTimeout(glowOffTimerRef.current);
    };

    const triggerReminder = () => {
        // 強制的に表示（非表示だった場合）
        // 名言をリシャッフルするかは要件次第だが、気分転換にリシャッフルする
        selectRandomQuote();
        setIsVisible(true);
        setIsGlowing(true);

        // 1分後に発光を停止
        if (glowOffTimerRef.current) clearTimeout(glowOffTimerRef.current);
        glowOffTimerRef.current = setTimeout(() => {
            setIsGlowing(false);
        }, GLOW_DURATION);
    };

    // 4. Interaction Handlers
    const handleTouchStart = () => {
        isLongPressTriggered.current = false;
        longPressTimerRef.current = setTimeout(() => {
            isLongPressTriggered.current = true;
            setIsModalOpen(true);
            // モーダルオープン時は発光止めるなどの微調整
            setIsGlowing(false);
        }, 800); // 800ms Long Press
    };

    const handleTouchEnd = () => {
        if (longPressTimerRef.current) {
            clearTimeout(longPressTimerRef.current);
        }

        if (!isLongPressTriggered.current) {
            // Short Press (Tap): Hide
            handleTap();
        }
    };

    const handleTap = () => {
        // タップで消える
        setIsVisible(false);
        setIsGlowing(false);
    };

    return (
        <>
            <AnimatePresence>
                {isVisible && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{
                            opacity: 1,
                            scale: 1,
                            textShadow: isGlowing
                                ? "0 0 10px rgba(255, 255, 255, 0.8), 0 0 20px rgba(52, 211, 153, 0.4)"
                                : "none",
                            filter: isGlowing
                                ? "drop-shadow(0 0 2px rgba(52, 211, 153, 0.5))"
                                : "none"
                        }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: FADE_DURATION }}
                        className={`ml-6 cursor-pointer select-none relative group`}
                        onMouseDown={handleTouchStart}
                        onMouseUp={handleTouchEnd}
                        onTouchStart={handleTouchStart}
                        onTouchEnd={handleTouchEnd}
                        title="タップで非表示 / 長押しで編集"
                    >
                        {/* Glow Animation Layer (Pulse) */}
                        {isGlowing && (
                            <motion.div
                                className="absolute inset-0 bg-emerald-400/20 rounded-lg blur-md"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: [0.2, 0.6, 0.2] }}
                                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                            />
                        )}

                        <span className={`text-[11px] font-bold font-serif italic transition-colors duration-500
                            ${isGlowing ? 'text-emerald-600 dark:text-emerald-300' : 'text-[rgb(130,141,159)]'}
                        `}>
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
