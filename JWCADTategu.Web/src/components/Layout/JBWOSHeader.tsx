import React, { useState } from 'react';
import { Menu, HelpCircle } from 'lucide-react';
// import { BackupSettings } from '../../features/core/jbwos/components/Settings/BackupSettings';
import { HealthCheck } from '../../features/core/jbwos/components/Layout/HealthCheck';
import { MenuDrawer } from './MenuDrawer'; // [NEW]

// Basic types needed for props
interface AuthUser {
    id: string;
    name: string;
    email: string;
}

interface Tenant {
    id: string;
    name: string;
    role: string;
}

interface JBWOSHeaderProps {
    currentView: 'jbwos' | 'today' | 'history' | 'settings' | 'customers' | 'companySettings';
    onNavigateToToday: () => void;
    onNavigateToHistory: () => void;
    onNavigateToProjects: () => void;
    onNavigateToSettings: () => void;
    onNavigateToCustomers?: () => void;
    onNavigateToPlanning?: () => void;
    onNavigateToCalendar?: () => void;
    onNavigateToCompanySettings?: () => void; // [NEW] Actually required if we use it, but safe optional for now
    user?: AuthUser | null; // [NEW]
    tenant?: Tenant | null; // [NEW]
}

export const JBWOSHeader: React.FC<JBWOSHeaderProps> = ({
    currentView,
    onNavigateToToday,
    onNavigateToHistory,
    onNavigateToProjects,
    onNavigateToSettings,
    onNavigateToCustomers,
    onNavigateToPlanning,
    onNavigateToCalendar,
    onNavigateToCompanySettings, // [NEW]
    user,   // [NEW]
    tenant  // [NEW]
}) => {
    const [menuOpen, setMenuOpen] = useState(false);

    // Legacy Fallback
    const getLegacyUserName = () => {
        try {
            const u = JSON.parse(localStorage.getItem('jbwos_user') || '{}');
            return u.name || 'User';
        } catch { return 'User'; }
    };

    return (
        <div className="bg-slate-800 text-white px-3 py-2 flex items-center justify-between shadow-md shrink-0 w-full relative z-30">
            <MenuDrawer
                isOpen={menuOpen}
                onClose={() => setMenuOpen(false)}
                onNavigateToToday={() => { onNavigateToToday(); setMenuOpen(false); }}
                onNavigateToHistory={() => { onNavigateToHistory(); setMenuOpen(false); }}
                onNavigateToProjects={() => { onNavigateToProjects(); setMenuOpen(false); }}
                onNavigateToSettings={() => { onNavigateToSettings(); setMenuOpen(false); }}
                onNavigateToCustomers={onNavigateToCustomers ? () => { onNavigateToCustomers(); setMenuOpen(false); } : undefined}
                onNavigateToPlanning={onNavigateToPlanning ? () => { onNavigateToPlanning(); setMenuOpen(false); } : undefined}
                onNavigateToManual={() => { /* Not implemented yet in props? */ setMenuOpen(false); }}
                onNavigateToCalendar={onNavigateToCalendar ? () => { onNavigateToCalendar(); setMenuOpen(false); } : undefined}
                onNavigateToCompanySettings={() => { if (onNavigateToCompanySettings) onNavigateToCompanySettings(); setMenuOpen(false); }}
                onLogout={() => {
                    localStorage.removeItem('jbwos_token');
                    localStorage.removeItem('jbwos_user');
                    window.location.href = './';
                }}
                userName={user?.name || getLegacyUserName()} // Fallback
                user={user}     // [NEW]
                tenant={tenant} // [NEW]
            />

            {/* Left: App Name */}
            <div className="flex items-center gap-2 md:gap-3 shrink-1 min-w-0">
                {/* [NEW] Hamburger Menu (Left Aligned for Mobile Standard) */}
                {/* [NEW] Hamburger Menu (PC: Left) */}
                <button
                    onClick={() => setMenuOpen(true)}
                    className="hidden md:block p-1.5 md:p-2 hover:bg-slate-700 rounded-lg transition-colors mr-1"
                    title="メニュー"
                >
                    <Menu size={20} className="text-slate-300" />
                </button>

                <div className="h-6 w-px bg-slate-600 shrink-0 mx-1"></div>

                <button
                    onClick={onNavigateToProjects}
                    className="text-xs text-slate-400 hover:text-white transition-colors whitespace-nowrap"
                >
                    <span className="hidden md:inline">← Projects</span>
                    <span className="md:hidden">Prj</span>
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

                {onNavigateToCalendar && (
                    <button
                        onClick={onNavigateToCalendar}
                        className="hidden md:block px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg font-bold text-sm text-slate-200 transition-all shadow-sm whitespace-nowrap"
                        title="Volume Calendar"
                    >
                        Volume
                    </button>
                )}

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

                {/* [NEW] Hamburger Menu (Mobile: Right) */}
                <button
                    onClick={() => setMenuOpen(true)}
                    className="md:hidden p-1.5 hover:bg-slate-700 rounded-lg transition-colors"
                    title="メニュー"
                >
                    <Menu size={20} className="text-slate-300" />
                </button>
            </div>
        </div>
    );
};
