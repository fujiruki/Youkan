import React, { useState } from 'react';
import { Menu, HelpCircle, History, Settings, Users } from 'lucide-react';
// import { BackupSettings } from '../../features/core/jbwos/components/Settings/BackupSettings';
import { HealthCheck } from '../../features/core/jbwos/components/Layout/HealthCheck';

interface JBWOSHeaderProps {
    currentView: 'jbwos' | 'today' | 'history' | 'settings' | 'customers';
    onNavigateToToday: () => void;
    onNavigateToHistory: () => void;
    onNavigateToProjects: () => void;
    onNavigateToSettings: () => void;
    onNavigateToCustomers?: () => void;
    onNavigateToPlanning?: () => void; // [NEW]
}

export const JBWOSHeader: React.FC<JBWOSHeaderProps> = ({
    currentView,
    onNavigateToToday,
    onNavigateToHistory,
    onNavigateToProjects,
    onNavigateToSettings,
    onNavigateToCustomers,
    onNavigateToPlanning // [NEW]
}) => {
    const [menuOpen, setMenuOpen] = useState(false);

    return (
        <div className="bg-slate-800 text-white px-3 py-2 flex items-center justify-between shadow-md overflow-hidden shrink-0 w-full">
            {/* Left: App Name */}
            <div className="flex items-center gap-2 md:gap-3 shrink-1 min-w-0">
                <button
                    onClick={onNavigateToProjects}
                    className="text-xs text-slate-400 hover:text-white transition-colors whitespace-nowrap"
                >
                    <span className="hidden md:inline">← Projects</span>
                    <span className="md:hidden">←</span>
                </button>
                <div className="h-4 w-px bg-slate-600 shrink-0"></div>
                <button
                    onClick={() => {
                        window.dispatchEvent(new KeyboardEvent('keydown', {
                            key: 'g',
                            ctrlKey: true
                        }));
                    }}
                    className="text-sm font-bold text-slate-100 hover:text-white transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1"
                    title="放り込み箱へ戻る (Ctrl+G)"
                >
                    📊 <span className="hidden xs:inline">JBWOS</span>
                </button>
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-2 md:gap-3 shrink-0">
                {/* Today Button (Priority) */}
                <button
                    onClick={onNavigateToToday}
                    className={`px-3 md:px-6 py-1.5 md:py-2 rounded-lg font-bold text-xs md:text-sm transition-all shadow-md whitespace-nowrap ${currentView === 'today'
                        ? 'bg-amber-500 text-white'
                        : 'bg-amber-400 text-white hover:bg-amber-500'
                        }`}
                >
                    Today
                </button>

                {/* Plan Button (Desktop Only) */}
                <button
                    onClick={onNavigateToPlanning}
                    className="hidden md:block px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg font-bold text-sm text-slate-200 transition-all shadow-sm whitespace-nowrap"
                    title="明日の計画"
                >
                    Plan
                </button>

                {/* Menu Dropdown */}
                <div className="relative">
                    <button
                        onClick={() => setMenuOpen(!menuOpen)}
                        className="p-1.5 md:p-2 hover:bg-slate-700 rounded-lg transition-colors"
                        title="メニュー"
                    >
                        <Menu size={20} className="text-slate-300" />
                    </button>

                    {menuOpen && (
                        <>
                            {/* Backdrop */}
                            <div
                                className="fixed inset-0 z-10"
                                onClick={() => setMenuOpen(false)}
                            ></div>

                            {/* Menu Content */}
                            <div className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 z-20 overflow-hidden">
                                {/* Mobile Only: Plan in Menu */}
                                <button
                                    onClick={() => {
                                        if (onNavigateToPlanning) onNavigateToPlanning();
                                        setMenuOpen(false);
                                    }}
                                    className="md:hidden w-full px-4 py-3 text-left text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors flex items-center gap-2"
                                >
                                    {/* Icon? */}
                                    Plan (明日の計画)
                                </button>

                                {onNavigateToCustomers && (
                                    <button
                                        onClick={() => {
                                            onNavigateToCustomers();
                                            setMenuOpen(false);
                                        }}
                                        className="w-full px-4 py-3 text-left text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors flex items-center gap-2"
                                    >
                                        <Users size={16} />
                                        顧客管理
                                    </button>
                                )}
                                <button
                                    onClick={() => {
                                        onNavigateToHistory();
                                        setMenuOpen(false);
                                    }}
                                    className="w-full px-4 py-3 text-left text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors flex items-center gap-2"
                                >
                                    <History size={16} />
                                    History（週間振り返り）
                                </button>
                                <div className="h-px bg-slate-200 dark:bg-slate-700"></div>
                                <button
                                    onClick={() => {
                                        onNavigateToSettings();
                                        setMenuOpen(false);
                                    }}
                                    className="w-full px-4 py-3 text-left text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors flex items-center gap-2"
                                >
                                    <Settings size={16} />
                                    設定
                                </button>
                            </div>
                        </>
                    )}
                </div>

                {/* Health Check */}
                <HealthCheck />

                {/* Help Button (Desktop Only) */}
                <button
                    onClick={() => {
                        // TODO: Help modal
                        alert('ヘルプは未実装');
                    }}
                    className="hidden md:block p-2 hover:bg-slate-700 rounded-lg transition-colors"
                    title="ヘルプ"
                >
                    <HelpCircle size={20} className="text-slate-400" />
                </button>
            </div>
        </div>
    );
};
