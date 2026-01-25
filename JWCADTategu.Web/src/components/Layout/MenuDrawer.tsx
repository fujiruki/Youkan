import React from 'react';
import { X, Calendar, CheckSquare, Clock, Settings, Users, BookOpen, LogOut, FileText } from 'lucide-react';
// import { cn } from '../../lib/utils';
// import { cn } from '../../lib/utils';

export interface MenuDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    onNavigateToToday: () => void;
    onNavigateToHistory: () => void;
    onNavigateToProjects: () => void;
    onNavigateToSettings: () => void;
    onNavigateToCustomers?: () => void;
    onNavigateToPlanning?: () => void;
    onNavigateToManual?: () => void;
    onLogout: () => void;
    userName?: string;
}

export const MenuDrawer: React.FC<MenuDrawerProps> = ({
    isOpen,
    onClose,
    onNavigateToToday,
    onNavigateToHistory,
    onNavigateToProjects,
    onNavigateToSettings,
    onNavigateToCustomers,
    onNavigateToPlanning,
    onNavigateToManual,
    onLogout,
    userName
}) => {
    if (!isOpen) return null;

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/50 z-40 animate-in fade-in duration-200"
                onClick={onClose}
            />

            {/* Side Panel */}
            <div className="fixed right-0 top-0 bottom-0 w-64 bg-slate-50 dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-xl z-50 animate-in slide-in-from-right duration-300 flex flex-col">
                {/* Header */}
                <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                    <div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">Signed in as</div>
                        <div className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate max-w-[150px]" title={userName}>
                            {userName || 'User'}
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors">
                        <X size={20} className="text-slate-500" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto py-2">
                    <nav className="space-y-1 px-2">
                        <MenuItem icon={<CheckSquare size={18} />} label="Today" onClick={onNavigateToToday} shortcut="Ctrl+T" />
                        {onNavigateToPlanning && <MenuItem icon={<Calendar size={18} />} label="Plan (明日の計画)" onClick={onNavigateToPlanning} />}
                        <MenuItem icon={<FileText size={18} />} label="Projects" onClick={onNavigateToProjects} />
                        <MenuItem icon={<Clock size={18} />} label="History" onClick={onNavigateToHistory} />
                        {onNavigateToCustomers && <MenuItem icon={<Users size={18} />} label="顧客管理" onClick={onNavigateToCustomers} />}

                        <div className="h-px bg-slate-200 dark:bg-slate-800 my-2 mx-2"></div>

                        <MenuItem icon={<Settings size={18} />} label="設定" onClick={onNavigateToSettings} />
                        {onNavigateToManual && <MenuItem icon={<BookOpen size={18} />} label="マニュアル" onClick={onNavigateToManual} />}
                    </nav>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950">
                    <button
                        onClick={onLogout}
                        className="w-full flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-lg transition-colors text-sm font-bold"
                    >
                        <LogOut size={18} />
                        ログアウト
                    </button>
                </div>
            </div>
        </>
    );
};

const MenuItem: React.FC<{ icon: React.ReactNode; label: string; onClick: () => void; shortcut?: string }> = ({ icon, label, onClick, shortcut }) => (
    <button
        onClick={onClick}
        className="w-full flex items-center justify-between px-3 py-2.5 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors group"
    >
        <div className="flex items-center gap-3">
            <span className="text-slate-400 group-hover:text-amber-500 transition-colors">{icon}</span>
            <span className="text-sm font-medium">{label}</span>
        </div>
        {shortcut && <span className="text-xs text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">{shortcut}</span>}
    </button>
);
