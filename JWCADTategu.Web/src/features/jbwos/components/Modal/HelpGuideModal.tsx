import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ArrowRight, CheckCircle2, Clock, Inbox, PlayCircle, Loader2, PauseCircle } from 'lucide-react';
// import { t } from '../../../../i18n/labels';

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

                            {/* Intro / Workflow Visualization */}
                            <div className="w-full mb-16">
                                <h3 className="text-center text-3xl font-bold text-slate-900 dark:text-white mb-8">
                                    <span className="text-amber-500">判断</span>の流れ
                                </h3>

                                <div className="flex flex-col md:flex-row items-center justify-center gap-4 md:gap-8 max-w-5xl mx-auto">
                                    {/* Step 1: Inbox */}
                                    <div className="flex flex-col items-center p-4 bg-white dark:bg-slate-800 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 w-full md:w-64 relative">
                                        <div className="absolute -top-3 left-4 bg-slate-500 text-white text-xs font-bold px-2 py-1 rounded">STEP 1</div>
                                        <Inbox className="w-8 h-8 text-slate-400 mb-2" />
                                        <h4 className="font-bold text-slate-700 dark:text-slate-200">Inbox (収集)</h4>
                                        <p className="text-xs text-center text-slate-500 mt-2">
                                            「燃えるゴミの日」<br />
                                            「A邸 建具DT-1製作」<br />
                                            すべてここに放り込む
                                        </p>
                                    </div>

                                    <ArrowRight className="w-6 h-6 text-slate-300 rotate-90 md:rotate-0" />

                                    {/* Step 2: GDB Judgment */}
                                    <div className="flex flex-col items-center p-6 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/10 rounded-xl border-2 border-amber-400 w-full md:w-72 shadow-lg relative z-10">
                                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-amber-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow-md">MAIN WORK</div>
                                        <span className="text-3xl mb-2">⚡</span>
                                        <h4 className="font-bold text-slate-800 dark:text-white text-lg">GDBで判断</h4>
                                        <div className="flex flex-col w-full gap-2 mt-4">
                                            <div className="flex items-center gap-2 text-xs bg-white/60 dark:bg-black/20 p-2 rounded">
                                                <span className="font-bold text-red-500">No</span>
                                                <span className="text-slate-600 dark:text-slate-400">→ やらない (Log/Del)</span>
                                            </div>
                                            <div className="flex items-center gap-2 text-xs bg-white/60 dark:bg-black/20 p-2 rounded">
                                                <span className="font-bold text-purple-500">Hold</span>
                                                <span className="text-slate-600 dark:text-slate-400">→ 今はできない (Waiting)</span>
                                            </div>
                                            <div className="flex items-center gap-2 text-xs bg-white/90 dark:bg-slate-800 p-2 rounded border border-amber-200 shadow-sm">
                                                <span className="font-bold text-amber-600">Yes</span>
                                                <span className="font-bold text-slate-800 dark:text-slate-200">→ 今日やる！(Ready)</span>
                                            </div>
                                        </div>
                                    </div>

                                    <ArrowRight className="w-6 h-6 text-slate-300 rotate-90 md:rotate-0" />

                                    {/* Step 3: Execution */}
                                    <div className="flex flex-col items-center p-4 bg-blue-50 dark:bg-blue-900/10 rounded-xl border border-blue-200 dark:border-blue-800 w-full md:w-64 relative">
                                        <div className="absolute -top-3 right-4 bg-blue-500 text-white text-xs font-bold px-2 py-1 rounded">GOAL</div>
                                        <PlayCircle className="w-8 h-8 text-blue-500 mb-2" />
                                        <h4 className="font-bold text-slate-700 dark:text-slate-200">Execution (実行)</h4>
                                        <div className="bg-white dark:bg-slate-800 p-2 rounded w-full mt-2 text-center border border-slate-200 dark:border-slate-700">
                                            <p className="text-xs font-bold text-blue-600 dark:text-blue-400 mb-1">今の「これ」だけ</p>
                                            <p className="text-[10px] text-slate-400">他は見ない。迷わない。</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Workflow Columns */}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

                                {/* Inbox */}
                                <GuideCard
                                    icon={<Inbox className="w-6 h-6 text-slate-500" />}
                                    title="Inbox（放り込み箱）"
                                    color="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                                    description="頭に浮かんだ全ての「気になること」の一時保管場所。判断はまだしません。"
                                    examples={["「燃えるゴミを出す」", "「A邸 建具DT-1製作」", "「集金の連絡」"]}
                                />

                                {/* Scheduled */}
                                <GuideCard
                                    icon={<Clock className="w-6 h-6 text-blue-500" />}
                                    title="Scheduled（予定/納期）"
                                    color="bg-blue-50 dark:bg-blue-900/10 border-blue-100 dark:border-blue-900/30"
                                    description="実行する日時が厳密に決まっているもの。カレンダーに入れます。"
                                    examples={["「14:00 打合せ」", "「金曜日 ゴミ出し」", "「20日 現場取付」"]}
                                />

                                {/* Waiting */}
                                <GuideCard
                                    icon={<PauseCircle className="w-6 h-6 text-purple-500" />}
                                    title="Waiting（塩漬け/待ち）"
                                    color="bg-purple-50 dark:bg-purple-900/10 border-purple-100 dark:border-purple-900/30"
                                    description="自分では進められないもの。他人の返信待ちや、条件が揃うのを待つ状態。"
                                    examples={["「元請けの承認待ち」", "「材料の入荷待ち」"]}
                                />

                                {/* Ready */}
                                <GuideCard
                                    icon={<PlayCircle className="w-6 h-6 text-amber-500" />}
                                    title="Ready（今日やる）"
                                    color="bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-900/30 ring-1 ring-amber-400/30"
                                    description="今日、絶対に完了させるタスク。最大2つまで。これを決めるのがGDBのゴールです。"
                                    examples={["「DT-1の組立完了」", "「見積書送付」"]}
                                    highlight
                                />

                                {/* Execution */}
                                <GuideCard
                                    icon={<Loader2 className="w-6 h-6 text-emerald-500" />}
                                    title="Execution（実行中）"
                                    color="bg-emerald-50 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-900/30"
                                    description="今この瞬間に手を動かしている、たった1つのこと。"
                                    examples={["「DT-1を加工している」", "「メールを書いている」"]}
                                />

                                {/* Done */}
                                <GuideCard
                                    icon={<CheckCircle2 className="w-6 h-6 text-slate-400" />}
                                    title="Done（事実/履歴）"
                                    color="bg-slate-100 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700"
                                    description="完了した事実。JBWOSはこれを「History」として記録し、あなたの仕事の証とします。"
                                    examples={["「加工完了」", "「送信済み」"]}
                                />

                            </div>

                            {/* Shortcuts Section */}
                            <div className="w-full mt-12 mb-8">
                                <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-6 flex items-center gap-2">
                                    <span className="text-2xl">⌨️</span>
                                    キーボードショートカット
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <ShortcutCard
                                        keys={["Alt", "D"]}
                                        action="直前の詳細を開く"
                                        description="Throw Inした直後に、納期やメモを入力したいときに使います。"
                                    />
                                    <ShortcutCard
                                        keys={["Ctrl", "Enter"]}
                                        action="今日やる (Commit)"
                                        description="詳細画面で、そのタスクを「今日やる」と決めて閉じます。"
                                    />
                                    <ShortcutCard
                                        keys={["Esc"]}
                                        action="閉じる"
                                        description="入力を保存して、詳細画面を閉じます（判断は保留）。"
                                    />
                                </div>
                            </div>

                            {/* Bottom Message */}
                            <div className="text-center pt-8 pb-4">
                                <p className="text-slate-500 dark:text-slate-400 text-sm">
                                    頭で管理せず、GDBで判断し、手だけを動かす。<br />
                                    それがプロフェッショナルの在り方です。
                                </p>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="flex-none p-6 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex justify-end">
                            <button
                                onClick={onClose}
                                className="px-8 py-3 font-bold bg-amber-500 hover:bg-amber-600 text-white rounded-lg shadow-lg shadow-amber-500/20 transition-all hover:scale-105"
                            >
                                閉じる
                            </button>
                        </div>

                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

const ShortcutCard: React.FC<{
    keys: string[];
    action: string;
    description: string;
}> = ({ keys, action, description }) => (
    <div className="bg-white dark:bg-slate-800 p-4 rounded-lg border border-slate-200 dark:border-slate-700 flex flex-col gap-2">
        <div className="flex items-center gap-2">
            <div className="flex gap-1">
                {keys.map((k, i) => (
                    <kbd key={i} className="px-2 py-1 bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded text-xs font-bold font-mono text-slate-700 dark:text-slate-200 shadow-sm">
                        {k}
                    </kbd>
                ))}
            </div>
            <span className="font-bold text-sm text-slate-800 dark:text-slate-100">{action}</span>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">
            {description}
        </p>
    </div>
);

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
                TODAY'S GOAL
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
            <p className="text-xs text-slate-500 dark:text-slate-400 font-bold mb-2 uppercase tracking-wider">例えば...</p>
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
