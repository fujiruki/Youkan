import React from 'react';
import { Item } from '../../types';
import { CheckCircle2, XCircle } from 'lucide-react';

interface Props {
    staleItems: Item[];
    onResolve: (itemIds: string[], action: 'completed_yesterday' | 'did_not_do') => void;
}

export const GentleReliefModal: React.FC<Props> = ({ staleItems, onResolve }) => {
    if (staleItems.length === 0) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-amber-200 dark:border-amber-800">
                {/* Header */}
                <div className="bg-amber-50 dark:bg-amber-900/30 p-6 text-center border-b border-amber-100 dark:border-amber-800/50">
                    <h2 className="text-xl font-bold text-amber-800 dark:text-amber-400 mb-2">
                        おかえりなさい
                    </h2>
                    <p className="text-sm text-slate-600 dark:text-slate-300">
                        昨日のお約束、どうなりましたか？<br />
                        <span className="text-xs text-slate-400">（正直に答えて大丈夫です。誰も責めません）</span>
                    </p>
                </div>

                {/* Stale Items List */}
                <div className="p-6 max-h-60 overflow-y-auto bg-slate-50/50 dark:bg-slate-900/50">
                    <ul className="space-y-3">
                        {staleItems.map(item => (
                            <li key={item.id} className="bg-white dark:bg-slate-700 p-3 rounded-lg shadow-sm border border-slate-100 dark:border-slate-600 flex items-center gap-3">
                                <span className="text-amber-500 font-bold">•</span>
                                <span className="font-medium text-slate-700 dark:text-slate-200">{item.title}</span>
                            </li>
                        ))}
                    </ul>
                </div>

                {/* Actions */}
                <div className="p-6 flex flex-col gap-3 bg-white dark:bg-slate-800">
                    <button
                        onClick={() => onResolve(staleItems.map(i => i.id), 'completed_yesterday')}
                        className="w-full py-3 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded-xl font-bold hover:bg-green-200 transition-colors flex items-center justify-center gap-2"
                    >
                        <CheckCircle2 size={20} />
                        実は昨日やりました (完了へ)
                    </button>

                    <button
                        onClick={() => onResolve(staleItems.map(i => i.id), 'did_not_do')}
                        className="w-full py-3 bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300 rounded-xl font-bold hover:bg-slate-200 transition-colors flex items-center justify-center gap-2"
                    >
                        <XCircle size={20} />
                        昨日はできませんでした (戻す)
                    </button>

                    <p className="text-center text-xs text-slate-400 mt-2">
                        「戻す」を選ぶと、今日の約束対象として再検討できます。<br />
                        ペナルティはありません。
                    </p>
                </div>
            </div>
        </div>
    );
};
