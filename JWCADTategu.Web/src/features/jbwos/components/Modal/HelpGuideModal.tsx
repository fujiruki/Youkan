import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ArrowRight, CheckCircle2, Clock, Inbox, PlayCircle, Loader2, PauseCircle } from 'lucide-react';
import { t } from '../../../../i18n/labels';

interface HelpGuideModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const HelpGuideModal: React.FC<HelpGuideModalProps> = ({ isOpen, onClose }) => {
    // Prevent background scroll when open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => { document.body.style.overflow = 'unset'; };
    }, [isOpen]);

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm"
                    />

                    {/* Modal Content */}
                    <motion.div
                        initial={{ opacity: 0, y: 40, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 40, scale: 0.95 }}
                        transition={{ duration: 0.4, type: "spring", bounce: 0.3 }}
                        className="relative z-10 w-full max-w-4xl h-[90vh] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden"
                    >
                        {/* Header */}
                        <div className="flex-none p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-900 z-20">
                            <div>
                                <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                    <span className="text-3xl">📘</span>
                                    JBWOS ガイド
                                </h2>
                                <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                                    「判断を終わらせる」ためのワークフロー
                                </p>
                            </div>
                            <button
                                onClick={onClose}
                                className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            >
                                <X className="w-6 h-6 text-slate-500" />
                            </button>
                        </div>

                        {/* Scrollable Body */}
                        <div className="flex-1 overflow-y-auto p-8 space-y-12 bg-slate-50/50 dark:bg-slate-950/50 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800">

                            {/* Intro Section */}
                            <div className="text-center max-w-2xl mx-auto mb-16">
                                <h3 className="text-3xl font-bold text-slate-900 dark:text-white mb-6 leading-tight">
                                    管理するな。<br />
                                    <span className="text-amber-500">判断せよ。</span>
                                </h3>
                                <p className="text-lg text-slate-600 dark:text-slate-300 leading-relaxed">
                                    JBWOSは、タスクを溜め込むためのリストではありません。<br />
                                    すべてのタスクに対して「いつやるか」「誰がやるか」を即座に判断し、<br />
                                    頭の中を空っぽにするためのツールです。
                                </p>
                            </div>

                            {/* Workflow Columns */}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

                                {/* Inbox */}
                                <GuideCard
                                    icon={<Inbox className="w-6 h-6 text-slate-500" />}
                                    title="Inbox（放り込み箱）"
                                    color="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                                    description="思いついたこと、頼まれたこと、全ての入り口。判断は後でいいので、まずはここに放り込みます。"
                                    examples={["「牛乳を買う」", "「クライアントにメール」", "「アイデア：新機能」"]}
                                />

                                {/* Scheduled */}
                                <GuideCard
                                    icon={<Clock className="w-6 h-6 text-blue-500" />}
                                    title="Scheduled（予定）"
                                    color="bg-blue-50 dark:bg-blue-900/10 border-blue-100 dark:border-blue-900/30"
                                    description="日時が決まっているアポイントや、締切が絶対のタスク。Googleカレンダーと連動します。"
                                    examples={["「14:00 定例会議」", "「明日締切の提出物」"]}
                                />

                                {/* Waiting */}
                                <GuideCard
                                    icon={<PauseCircle className="w-6 h-6 text-purple-500" />}
                                    title="Waiting（待ち）"
                                    color="bg-purple-50 dark:bg-purple-900/10 border-purple-100 dark:border-purple-900/30"
                                    description="ボールは自分にありません。誰かの返信待ちや、承認待ちの状態。"
                                    examples={["「Aさんの返信待ち」", "「見積承認待ち」"]}
                                />

                                {/* Ready */}
                                <GuideCard
                                    icon={<PlayCircle className="w-6 h-6 text-amber-500" />}
                                    title="Ready（今日やる）"
                                    color="bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-900/30 ring-1 ring-amber-400/30"
                                    description="今日、絶対に完了させるタスク。最大2つまでしか登録できません。集中力の限界です。"
                                    examples={["「提案書を完成させる」", "「バグ修正 A」"]}
                                    highlight
                                />

                                {/* Execution */}
                                <GuideCard
                                    icon={<Loader2 className="w-6 h-6 text-emerald-500" />}
                                    title="Execution（実行中）"
                                    color="bg-emerald-50 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-900/30"
                                    description="今まさに手を動かしているタスク。常に1つだけにしましょう。"
                                    examples={["「コードを書いている」", "「メールを作成中」"]}
                                />

                                {/* Done */}
                                <GuideCard
                                    icon={<CheckCircle2 className="w-6 h-6 text-slate-400" />}
                                    title="Done（完了）"
                                    color="bg-slate-100 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700"
                                    description="完了したタスクの墓場であり、実績のリスト。定期的に見返して空にします。"
                                    examples={["「会議終了」", "「送信済み」"]}
                                />

                            </div>

                            {/* Bottom Message */}
                            <div className="text-center pt-8 pb-4">
                                <p className="text-slate-500 dark:text-slate-400 text-sm">
                                    迷ったら、まずは Inbox に。<br />
                                    そして、今日の Ready 2つを決めることから始めましょう。
                                </p>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="flex-none p-6 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex justify-end">
                            <button
                                onClick={onClose}
                                className="px-8 py-3 font-bold bg-amber-500 hover:bg-amber-600 text-white rounded-lg shadow-lg shadow-amber-500/20 transition-all hover:scale-105"
                            >
                                理解した
                            </button>
                        </div>

                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

// Helper Component for Cards
const GuideCard: React.FC<{
    icon: React.ReactNode;
    title: string;
    description: string;
    examples: string[];
    color: string;
    highlight?: boolean;
}> = ({ icon, title, description, examples, color, highlight }) => (
    <div className={`p-6 rounded-xl border ${color} relative group transition-all hover:scale-[1.02] hover:shadow-lg`}>
        {highlight && (
            <div className="absolute -top-3 -right-3 bg-amber-500 text-white text-[10px] font-bold px-2 py-1 rounded-full shadow-md">
                MOST IMPORTANT
            </div>
        )}
        <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-white dark:bg-slate-900 rounded-lg shadow-sm">
                {icon}
            </div>
            <h4 className="font-bold text-slate-900 dark:text-white text-lg">{title}</h4>
        </div>
        <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed mb-4 min-h-[48px]">
            {description}
        </p>
        <div className="bg-white/50 dark:bg-black/20 rounded-lg p-3">
            <p className="text-xs text-slate-500 dark:text-slate-400 font-bold mb-2 uppercase tracking-wider">Examples</p>
            <ul className="space-y-1">
                {examples.map((ex, i) => (
                    <li key={i} className="text-sm text-slate-700 dark:text-slate-200 flex items-center gap-2">
                        <ArrowRight className="w-3 h-3 text-slate-400" />
                        {ex}
                    </li>
                ))}
            </ul>
        </div>
    </div>
);
