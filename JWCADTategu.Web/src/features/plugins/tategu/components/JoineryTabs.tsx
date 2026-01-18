import React from 'react';
import { clsx } from 'clsx';
import { Search } from 'lucide-react';

export type JoineryTab = 'products' | 'notes' | 'deliverables';

interface JoineryTabsProps {
    activeTab: JoineryTab;
    onTabChange: (tab: JoineryTab) => void;

    // Filter Options (Displays when products tab is active)
    searchQuery: string;
    onSearchChange: (query: string) => void;
    showCost: boolean;
    onShowCostChange: (show: boolean) => void;
}

export const JoineryTabs: React.FC<JoineryTabsProps> = ({
    activeTab,
    onTabChange,
    searchQuery,
    onSearchChange,
    showCost,
    onShowCostChange
}) => {
    return (
        <div className="flex justify-between items-end mb-6 shrink-0">
            <div className="flex gap-4 border-b border-slate-800">
                <button
                    onClick={() => onTabChange('products')}
                    className={clsx(
                        "pb-2 px-1 text-sm font-medium transition-colors relative",
                        activeTab === 'products' ? "text-emerald-400" : "text-slate-500 hover:text-slate-300"
                    )}
                >
                    建具・製品一覧
                    {activeTab === 'products' && (
                        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-500" />
                    )}
                </button>
                <button
                    onClick={() => onTabChange('deliverables')}
                    className={clsx(
                        "pb-2 px-1 text-sm font-medium transition-colors relative",
                        activeTab === 'deliverables' ? "text-purple-400" : "text-slate-500 hover:text-slate-300"
                    )}
                >
                    成果物（Manifest）
                    {activeTab === 'deliverables' && (
                        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-500" />
                    )}
                </button>
                <button
                    onClick={() => onTabChange('notes')}
                    className={clsx(
                        "pb-2 px-1 text-sm font-medium transition-colors relative",
                        activeTab === 'notes' ? "text-emerald-400" : "text-slate-500 hover:text-slate-300"
                    )}
                >
                    野帳・メモ
                    {activeTab === 'notes' && (
                        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-500" />
                    )}
                </button>
            </div>

            {activeTab === 'products' && (
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                        <input
                            type="text"
                            placeholder="名前やタグで検索..."
                            value={searchQuery}
                            onChange={(e) => onSearchChange(e.target.value)}
                            className="pl-9 pr-3 py-1.5 bg-slate-900 border border-slate-800 rounded-full text-sm focus:outline-none focus:border-emerald-500/50 w-64 transition-all"
                        />
                    </div>
                    <label className="flex items-center gap-2 text-sm text-slate-400 cursor-pointer hover:text-slate-300">
                        <input
                            type="checkbox"
                            checked={showCost}
                            onChange={(e) => onShowCostChange(e.target.checked)}
                            className="rounded border-slate-700 bg-slate-800 text-emerald-500 focus:ring-emerald-500/50"
                        />
                        概算金額を表示
                    </label>
                </div>
            )}
        </div>
    );
};
