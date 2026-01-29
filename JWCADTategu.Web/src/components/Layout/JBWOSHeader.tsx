import React, { useState } from 'react';
import { Menu, LayoutDashboard, FolderKanban, CalendarDays } from 'lucide-react';
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
    representativeName?: string;
    representativeEmail?: string;
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
    joinedTenants?: Tenant[];
    onSwitchTenant?: (tenantId: string | null) => void;
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
    tenant,
    joinedTenants = [],
    onSwitchTenant
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
        <div className="flex flex-col shrink-0 w-full relative">
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
                joinedTenants={joinedTenants}
                onSwitchTenant={onSwitchTenant}
            />

            {/* Top Info Bar (For AI Awareness & Debugging) */}
            <div className="bg-slate-900/90 px-4 py-1 flex flex-wrap justify-between gap-x-6 items-center text-[9px] text-slate-400 font-mono border-b border-slate-700/50 w-full select-none z-40">

                {/* Left side: Context Info */}
                <div className="flex items-center gap-4">
                    <span className={tenant ? "text-amber-400 font-bold" : "text-emerald-400 font-bold"}>
                        {tenant ? `[MEMBER OF: ${tenant.name.toUpperCase()}]` : '[PERSONAL_ACCOUNT]'}
                    </span>
                    {tenant && (
                        <span>
                            REP: <span className="text-slate-300">{tenant.representativeName || 'N/A'}</span>
                            {tenant.representativeEmail && <span className="text-slate-500 ml-1">({tenant.representativeEmail})</span>}
                        </span>
                    )}
                </div>

                {/* Right side: User & Health */}
                <div className="flex items-center gap-4">
                    <span>
                        LOGGED IN: <span className="text-slate-300">{(user?.name || getLegacyUserName()).toUpperCase()}</span>
                        {user?.email && <span className="text-slate-500 ml-1">({user.email})</span>}
                    </span>
                    <HealthCheck />
                </div>
            </div>

            {/* Main Header Bar */}
            <div className="bg-slate-800/95 px-4 py-1 flex flex-wrap items-center gap-x-4 border-b border-slate-700/30 w-full shadow-lg z-40">

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

                    {/* The MenuDrawer below was a duplicate and has been removed to fix the JSX structure.
                        The first MenuDrawer is correctly placed at the top of the main header div.
                    <MenuDrawer
                        isOpen={menuOpen}
                        onClose={() => setMenuOpen(false)}
                        user={user}
                        tenant={tenant}
                        joinedTenants={joinedTenants}
                        onSwitchTenant={onSwitchTenant}
                        onNavigateToToday={onNavigateToToday}
                        onNavigateToDashboard={onNavigateToDashboard}
                        onNavigateToHistory={onNavigateToHistory}
                        onNavigateToProjects={onNavigateToProjects}
                        onNavigateToSettings={onNavigateToSettings}
                        onNavigateToCustomers={onNavigateToCustomers}
                        onNavigateToPlanning={onNavigateToPlanning}
                        onNavigateToCalendar={onNavigateToCalendar || (() => { })}
                        onNavigateToCompanySettings={onNavigateToCompanySettings}
                        onNavigateToPersonalSettings={onNavigateToPersonalSettings}
                        onLogout={() => {
                            console.log('Logging out...');
                            localStorage.removeItem('jbwos_token');
                            window.location.reload();
                        }}
                    />
                    */}
                </div>
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
