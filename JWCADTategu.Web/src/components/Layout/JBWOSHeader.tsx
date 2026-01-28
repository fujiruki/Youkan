import React, { useState } from 'react';
import { Menu, LayoutDashboard, FolderKanban, CalendarDays, ChevronDown } from 'lucide-react';
import { HealthCheck } from '../../features/core/jbwos/components/Layout/HealthCheck';
import { MenuDrawer } from './MenuDrawer';

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
    currentView: 'jbwos' | 'today' | 'history' | 'settings' | 'customers' | 'companySettings' | 'dashboard' | 'userlist' | 'projects' | 'calendar' | 'planning' | 'personalSettings';
    onNavigateToToday: () => void;
    onNavigateToDashboard: () => void;  // NEW: Navigate to Dashboard (Focus view)
    onNavigateToHistory: () => void;
    onNavigateToProjects: () => void;
    onNavigateToSettings: () => void;
    onNavigateToCustomers?: () => void;
    onNavigateToPlanning?: () => void;
    onNavigateToCalendar?: () => void;
    onNavigateToCompanySettings?: () => void;
    onNavigateToPersonalSettings?: () => void;
    user?: AuthUser | null;
    tenant?: Tenant | null;
}

export const JBWOSHeader: React.FC<JBWOSHeaderProps> = ({
    currentView,
    onNavigateToToday,
    onNavigateToDashboard,
    onNavigateToHistory,
    onNavigateToProjects,
    onNavigateToSettings,
    onNavigateToCustomers,
    onNavigateToPlanning,
    onNavigateToCalendar,
    onNavigateToCompanySettings,
    onNavigateToPersonalSettings,
    user,
    tenant
}) => {
    const [menuOpen, setMenuOpen] = useState(false);

    // Legacy Fallback
    const getLegacyUserName = () => {
        try {
            const u = JSON.parse(localStorage.getItem('jbwos_user') || '{}');
            return u.name || 'User';
        } catch { return 'User'; }
    };

    // Navigate to Dashboard (Home)
    const handleGoHome = () => {
        onNavigateToDashboard();
    };

    // Check if current view is a primary navigation target
    const isDashboard = currentView === 'dashboard' || currentView === 'jbwos';
    const isProjects = currentView === 'projects';
    const isCalendar = currentView === 'calendar' || currentView === 'planning';

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
                onNavigateToManual={() => { setMenuOpen(false); }}
                onNavigateToCalendar={onNavigateToCalendar ? () => { onNavigateToCalendar(); setMenuOpen(false); } : undefined}
                onNavigateToCompanySettings={() => { if (onNavigateToCompanySettings) onNavigateToCompanySettings(); setMenuOpen(false); }}
                onNavigateToPersonalSettings={() => { if (onNavigateToPersonalSettings) onNavigateToPersonalSettings(); setMenuOpen(false); }}
                onLogout={() => {
                    localStorage.removeItem('jbwos_token');
                    localStorage.removeItem('jbwos_user');
                    window.location.href = './';
                }}
                userName={user?.name || getLegacyUserName()}
                user={user}
                tenant={tenant}
            />

            {/* Left: Logo/Home + Hamburger */}
            <div className="flex items-center gap-2 shrink-0">
                {/* Hamburger Menu */}
                <button
                    onClick={() => setMenuOpen(true)}
                    className="p-1.5 md:p-2 hover:bg-slate-700 rounded-lg transition-colors"
                    title="メニュー"
                >
                    <Menu size={20} className="text-slate-300" />
                </button>

                {/* Logo / Home */}
                <button
                    onClick={handleGoHome}
                    className="hidden md:flex items-center gap-1.5 px-2 py-1 hover:bg-slate-700 rounded-lg transition-colors"
                    title="ホームへ戻る"
                >
                    <span className="text-lg">⚡</span>
                    <span className="text-sm font-bold text-slate-200">JBWOS</span>
                </button>
            </div>

            {/* Center: Primary Navigation Tabs (PC) */}
            <div className="flex-1 flex items-center justify-center">
                <nav className="flex items-center bg-slate-700/50 rounded-lg p-1 gap-1">
                    {/* Dashboard Tab */}
                    <NavTab
                        icon={<LayoutDashboard size={16} />}
                        label="Dashboard"
                        isActive={isDashboard}
                        onClick={onNavigateToDashboard}
                    />

                    {/* Projects Tab */}
                    <NavTab
                        icon={<FolderKanban size={16} />}
                        label="Projects"
                        isActive={isProjects}
                        onClick={onNavigateToProjects}
                    />

                    {/* Calendar Tab */}
                    <NavTab
                        icon={<CalendarDays size={16} />}
                        label="Calendar"
                        isActive={isCalendar}
                        onClick={onNavigateToCalendar || (() => { })}
                    />
                </nav>
            </div>

            {/* Right: API Indicator + User Menu */}
            <div className="flex items-center gap-2 shrink-0">
                {/* API Health Check (Development) */}
                <HealthCheck />

                {/* User Menu */}
                <button
                    onClick={() => setMenuOpen(true)}
                    className="flex items-center gap-1 px-2 py-1.5 hover:bg-slate-700 rounded-lg transition-colors"
                    title="ユーザーメニュー"
                >
                    <div className="w-7 h-7 rounded-full bg-indigo-500 flex items-center justify-center text-xs font-bold text-white">
                        {(user?.name || getLegacyUserName()).charAt(0).toUpperCase()}
                    </div>
                    <ChevronDown size={14} className="text-slate-400 hidden md:block" />
                </button>
            </div>
        </div>
    );
};

// Navigation Tab Component
const NavTab: React.FC<{
    icon: React.ReactNode;
    label: string;
    isActive: boolean;
    onClick: () => void;
}> = ({ icon, label, isActive, onClick }) => (
    <button
        onClick={onClick}
        className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-all ${isActive
            ? 'bg-white text-slate-900 shadow-sm'
            : 'text-slate-300 hover:text-white hover:bg-slate-600'
            }`}
    >
        <span className={isActive ? 'text-indigo-600' : 'text-slate-400'}>{icon}</span>
        <span className="hidden md:inline">{label}</span>
    </button>
);
