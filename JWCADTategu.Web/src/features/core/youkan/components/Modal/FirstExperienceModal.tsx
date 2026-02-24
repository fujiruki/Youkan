import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface FirstExperienceModalProps {
    onComplete: () => void;
}

export const FirstExperienceModal: React.FC<FirstExperienceModalProps> = ({ onComplete }) => {
    const [step, setStep] = useState(1);

    const handleNext = () => {
        if (step === 1) {
            setStep(2);
        } else {
            onComplete();
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/90 backdrop-blur-md">
            <AnimatePresence mode="wait">
                {step === 1 && (
                    <motion.div
                        key="step1"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ duration: 0.6, ease: "easeOut" }}
                        className="max-w-2xl w-full p-8 text-center text-white"
                    >
                        <h1 className="text-3xl md:text-4xl font-bold mb-12 leading-relaxed tracking-wide font-sans">
                            このツールは<br />
                            あなたを「時間管理」から解放し、<br />
                            <span className="text-amber-400">「判断を終わらせる」</span>ための道具です。
                        </h1>

                        <div className="text-lg md:text-xl text-slate-300 mb-16 leading-loose">
                            <p>予定を完璧に立てなくていい。</p>
                            <p>今、考えられないことは、考えなくていい。</p>
                        </div>

                        <button
                            onClick={handleNext}
                            className="group relative px-8 py-4 bg-white/10 hover:bg-white/20 border border-white/30 rounded-full text-lg font-medium transition-all hover:scale-105 active:scale-95"
                        >
                            <span className="relative z-10">よく分からないけど、はじめる</span>
                            <div className="absolute inset-0 rounded-full bg-white/5 blur-lg opacity-0 group-hover:opacity-100 transition-opacity" />
                        </button>
                    </motion.div>
                )}

                {step === 2 && (
                    <motion.div
                        key="step2"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        transition={{ duration: 0.4 }}
                        className="max-w-lg w-full bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 relative overflow-hidden"
                    >
                        {/* Decorative background element */}
                        <div className="absolute -top-20 -right-20 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

                        <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-6 flex items-center gap-3">
                            <span className="text-3xl">📥</span>
                            Inbox（放り込み箱）とは
                        </h2>

                        <div className="text-slate-600 dark:text-slate-300 space-y-4 mb-8 text-lg leading-relaxed">
                            <p>
                                <strong className="text-slate-800 dark:text-white border-b-2 border-amber-400/50">「今は考えられないものを放り込む場所」</strong>です。
                            </p>
                            <p>
                                思いついた瞬間に、判断しなくていい。<br />
                                迷ったら、ここに入れてください。
                            </p>
                        </div>

                        <div className="flex justify-end">
                            <button
                                onClick={handleNext}
                                className="px-6 py-2.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-lg font-medium hover:opacity-90 transition-opacity shadow-lg"
                            >
                                Youkanをはじめる
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};
