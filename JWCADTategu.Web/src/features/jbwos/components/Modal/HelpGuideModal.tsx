import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ArrowRight, CheckCircle2, Clock, Inbox, PlayCircle, Loader2, PauseCircle } from 'lucide-react';
// import { t } from '../../../../i18n/labels';

// Helper for Scenarios
function ScenarioCard({ emoji, title, solution }: { emoji: string; title: string; solution: string }) {
    return (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 flex gap-4">
            <div className="text-3xl shrink-0 bg-slate-50 dark:bg-slate-900 w-12 h-12 flex items-center justify-center rounded-full">
                {emoji}
            </div>
            <div>
                <h5 className="font-bold text-slate-800 dark:text-slate-200 mb-2 text-sm">{title}</h5>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    {solution}
                </p>
            </div>
        </div>
    );
}

function ShortcutCard({ keys, action, description }: {
    keys: string[];
    action: string;
    description: string;
}) {
    return (
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
}

function GuideCard({ icon, title, description, examples, color, highlight }: {
    icon: React.ReactNode;
    title: string;
    description: string;
    examples: string[];
    color: string;
    highlight?: boolean;
}) {
    return (
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
}

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
                        className="relative z-10 w-full max-w-5xl h-[90vh] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden"
                    >
                        {/* Header */}
                        <div className="flex-none p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-900 z-20">
                            <div>
                                <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                    <span className="text-3xl">🛡️</span>
                                    JBWOS ガイド
                                </h2>
                                <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                                    約束を「今日」だけに限定し、あなたの心を守るシステム
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
                        <div className="flex-1 overflow-y-auto bg-slate-50/50 dark:bg-slate-950/50 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800 pb-20">

                            {/* Section 1: Hero / Philosophy */}
                            <div className="bg-gradient-to-br from-indigo-900 to-slate-900 text-white p-12 text-center relative overflow-hidden">
                                <div className="absolute top-0 left-0 w-full h-full opacity-10 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] mix-blend-overlay"></div>
                                <h3 className="text-3xl md:text-5xl font-extrabold mb-6 relative z-10">
                                    約束は、今日だけ。
                                </h3>
                                <p className="text-lg md:text-xl text-indigo-100 max-w-2xl mx-auto leading-relaxed relative z-10">
                                    未来の不安も、過去の後悔も、ここには持ち込まない。<br />
                                    あなたが守るべき約束は、今ここにある「Today」だけです。
                                </p>
                            </div>

                            {/* Section 2: Flow Visualization */}
                            <div className="max-w-4xl mx-auto py-16 px-6">
                                <h4 className="text-center text-xl font-bold text-slate-800 dark:text-slate-200 mb-12 flex items-center justify-center gap-2">
                                    <span className="bg-amber-100 text-amber-700 px-3 py-1 rounded-full text-sm">FLOW</span>
                                    判断と実行の流れ
                                </h4>

                                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-stretch text-center">
                                    {/* S1 */}
                                    <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col items-center">
                                        <div className="bg-slate-100 dark:bg-slate-700 p-3 rounded-full mb-4">
                                            <Inbox size={24} className="text-slate-500" />
                                        </div>
                                        <h5 className="font-bold mb-2">1. 放り込む</h5>
                                        <p className="text-xs text-slate-500">Inbox</p>
                                        <p className="text-xs text-slate-400 mt-2">思いついたらすぐ入れて忘れる</p>
                                    </div>
                                    <div className="hidden md:flex items-center justify-center text-slate-300">
                                        <ArrowRight />
                                    </div>
                                    {/* S2 */}
                                    <div className="bg- Amber-50 dark:bg-amber-900/10 p-6 rounded-xl border-2 border-amber-400 shadow-xl flex flex-col items-center transform md:scale-110 z-10">
                                        <div className="bg-amber-100 dark:bg-amber-800 p-3 rounded-full mb-4">
                                            <span className="text-2xl">⚡</span>
                                        </div>
                                        <h5 className="font-bold text-amber-800 dark:text-amber-200 mb-2">2. 判断する</h5>
                                        <p className="text-xs text-amber-600 dark:text-amber-400">GDB (Global Board)</p>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">今日やるか、やらないか決めるだけ</p>
                                    </div>
                                    <div className="hidden md:flex items-center justify-center text-slate-300">
                                        <ArrowRight />
                                    </div>
                                    {/* S3 */}
                                    <div className="bg-blue-50 dark:bg-blue-900/10 p-6 rounded-xl border border-blue-200 dark:border-blue-800 flex flex-col items-center">
                                        <div className="bg-blue-100 dark:bg-blue-800 p-3 rounded-full mb-4">
                                            <PlayCircle size={24} className="text-blue-600" />
                                        </div>
                                        <h5 className="font-bold text-blue-800 dark:text-blue-200 mb-2">3. 実行する</h5>
                                        <p className="text-xs text-blue-600 dark:text-blue-400">Today</p>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">決めたことを淡々とやる</p>
                                    </div>
                                </div>
                            </div>

                            {/* Detailed Workflow Definitions */}
                            <div className="max-w-6xl mx-auto py-16 px-6">
                                <h4 className="text-center text-xl font-bold text-slate-800 dark:text-slate-200 mb-12">
                                    各レーンの役割とルール
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    <GuideCard
                                        icon={<Inbox className="w-6 h-6 text-slate-500" />}
                                        title="Inbox（放り込み箱）"
                                        color="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                                        description="頭に浮かんだ全ての「気になること」の一時保管場所。判断はまだしません。"
                                        examples={["「燃えるゴミを出す」", "「A邸 建具DT-1製作」", "「集金の連絡」"]}
                                    />
                                    <GuideCard
                                        icon={<Clock className="w-6 h-6 text-blue-500" />}
                                        title="Scheduled（予定/納期）"
                                        color="bg-blue-50 dark:bg-blue-900/10 border-blue-100 dark:border-blue-900/30"
                                        description="実行する日時が厳密に決まっているもの。カレンダーに入れます。"
                                        examples={["「14:00 打合せ」", "「金曜日 ゴミ出し」", "「20日 現場取付」"]}
                                    />
                                    <GuideCard
                                        icon={<PauseCircle className="w-6 h-6 text-purple-500" />}
                                        title="Waiting（塩漬け/待ち）"
                                        color="bg-purple-50 dark:bg-purple-900/10 border-purple-100 dark:border-purple-900/30"
                                        description="自分では進められないもの。他人の返信待ちや、条件が揃うのを待つ状態。"
                                        examples={["「元請けの承認待ち」", "「材料の入荷待ち」"]}
                                    />
                                    <GuideCard
                                        icon={<PlayCircle className="w-6 h-6 text-amber-500" />}
                                        title="Ready（今日やる）"
                                        color="bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-900/30 ring-1 ring-amber-400/30"
                                        description="今日、絶対に完了させるタスク。最大2つまで。これを決めるのがGDBのゴールです。"
                                        examples={["「DT-1の組立完了」", "「見積書送付」"]}
                                        highlight
                                    />
                                    <GuideCard
                                        icon={<Loader2 className="w-6 h-6 text-emerald-500" />}
                                        title="Execution（実行中）"
                                        color="bg-emerald-50 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-900/30"
                                        description="今この瞬間に手を動かしている、たった1つのこと。"
                                        examples={["「DT-1を加工している」", "「メールを書いている」"]}
                                    />
                                    <GuideCard
                                        icon={<CheckCircle2 className="w-6 h-6 text-slate-400" />}
                                        title="Done（事実/履歴）"
                                        color="bg-slate-100 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700"
                                        description="完了した事実。JBWOSはこれを「History」として記録し、あなたの仕事の証とします。"
                                        examples={["「加工完了」", "「送信済み」"]}
                                    />
                                </div>
                            </div>

                            {/* Section 3: Scenarios (Q&A style) */}
                            <div className="bg-slate-100 dark:bg-slate-900/50 py-16 px-6">
                                <div className="max-w-4xl mx-auto">
                                    <h4 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-8 text-center">
                                        こんなときは？ よくあるシチュエーション
                                    </h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <ScenarioCard
                                            emoji="😵"
                                            title="やることが多すぎてパニック！"
                                            solution="とりあえず、全部Inboxに書き出しましょう。「頭の中」を空っぽにすることが最優先です。GDBでの判断はその後でOK。"
                                        />
                                        <ScenarioCard
                                            emoji="🗓️"
                                            title="「いつかやる」ものが溜まっていく..."
                                            solution="Intent（やれたらいい）レーンに移動させましょう。約束はしません。気が向いた時にそこから拾えばいいのです。"
                                        />
                                        <ScenarioCard
                                            emoji="🙅"
                                            title="今日やろうと思ったけど、やれない"
                                            solution="罪悪感はいりません。「保留 (Hold)」を押して、堂々と先送りにしましょう。システムはそれを「賢い判断」として記録します。"
                                        />
                                        <ScenarioCard
                                            emoji="🌫️"
                                            title="納期が決まっていない仕事はどうする？"
                                            solution="「備え（Blurry）」として扱います。日付は決めず、量感カレンダーに置いておき、近づいてきたら判断します。"
                                        />
                                        <ScenarioCard
                                            emoji="🧹"
                                            title="掃除やルーチンワークは？"
                                            solution="Lifeレーン（習慣）を使います。これらは「判断」の対象外です。やれなくてもシステムはあなたを責めません。"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Shortcuts */}
                            <div className="max-w-4xl mx-auto py-12 px-6">
                                <h4 className="font-bold text-slate-400 uppercase tracking-wider mb-6 text-xs text-center">Keyboard Shortcuts</h4>
                                <div className="flex flex-wrap justify-center gap-6">
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

                        </div>

                        {/* Footer */}
                        <div className="flex-none p-6 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex justify-center">
                            <button
                                onClick={onClose}
                                className="px-8 py-3 font-bold bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-full shadow-lg hover:transform hover:scale-105 transition-all text-sm"
                            >
                                わかった。判断に戻る
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};


