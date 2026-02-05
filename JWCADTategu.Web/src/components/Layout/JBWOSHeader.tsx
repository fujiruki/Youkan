import React, { useState, useEffect } from 'react';
import { Menu, LayoutDashboard, FolderKanban, CalendarDays, User, Briefcase, Layers, Settings } from 'lucide-react';
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

type FilterMode = 'all' | 'personal' | 'company';

interface JBWOSHeaderProps {
    currentView: 'jbwos' | 'today' | 'history' | 'settings' | 'customers' | 'companySettings' | 'dashboard' | 'userlist' | 'projects' | 'calendar' | 'planning' | 'personalSettings';
    onNavigateToToday: () => void;
    onNavigateToDashboard: () => void;
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
    const [filterMode, setFilterMode] = useState<FilterMode>(() => {
        const saved = localStorage.getItem('jbwos_global_filter');
        return (saved as FilterMode) || 'all';
    });

    // Persist filter mode
    useEffect(() => {
        localStorage.setItem('jbwos_global_filter', filterMode);
        // Dispatch global event for other components
        window.dispatchEvent(new CustomEvent('jbwos-filter-change', { detail: { mode: filterMode } }));
    }, [filterMode]);

    const getLegacyUserName = () => {
        try {
            const u = JSON.parse(localStorage.getItem('jbwos_user') || '{}');
            return u.name || 'User';
        } catch { return 'User'; }
    };

    const handleGoHome = () => {
        onNavigateToDashboard();
    };

    // Check active states
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
                onNavigateToManual={() => { window.open('./docs/manual.html', '_blank'); setMenuOpen(false); }}
                onNavigateToLP={() => { window.open('./docs/landing.html', '_blank'); setMenuOpen(false); }}
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

            {/* 層1: グローバルバー - ロゴ、時間バー、フィルタ、ユーザー */}
            <div className="bg-slate-900 px-4 py-1.5 flex items-center gap-4 border-b border-slate-700/50 w-full z-40">

                {/* Left: Menu + Logo */}
                <div className="flex items-center gap-2 shrink-0">
                    <button
                        onClick={() => setMenuOpen(true)}
                        className="p-1.5 hover:bg-slate-700 rounded-lg transition-colors"
                        title="メニュー"
                    >
                        <Menu size={18} className="text-slate-300" />
                    </button>
                    <button
                        onClick={handleGoHome}
                        className="flex items-center gap-1 px-2 py-1 hover:bg-slate-700 rounded-lg transition-colors"
                        title="ホームへ戻る"
                    >
                        <span className="text-base">⚡</span>
                        <span className="text-xs font-bold text-slate-200 hidden sm:inline">JBWOS</span>
                    </button>
                </div>

                {/* Center: 時間バー (プログレスバー) */}
                <div className="flex-1 max-w-md hidden md:block">
                    <TimeProgressBar />
                </div>

                {/* Right: フィルタ + 設定 + ユーザー */}
                <div className="flex items-center gap-3 shrink-0 ml-auto">
                    {/* フィルタボタン群 */}
                    <div className="flex items-center bg-slate-800 p-0.5 rounded-lg border border-slate-700">
                        <FilterButton
                            active={filterMode === 'all'}
                            onClick={() => setFilterMode('all')}
                            icon={<Layers size={12} />}
                            label="全て"
                        />
                        <FilterButton
                            active={filterMode === 'personal'}
                            onClick={() => setFilterMode('personal')}
                            icon={<User size={12} />}
                            label="個人"
                        />
                        <FilterButton
                            active={filterMode === 'company'}
                            onClick={() => setFilterMode('company')}
                            icon={<Briefcase size={12} />}
                            label="会社"
                        />
                    </div>

                    {/* Settings */}
                    <button
                        onClick={onNavigateToSettings}
                        className="p-1.5 hover:bg-slate-700 rounded-lg transition-colors"
                        title="設定"
                    >
                        <Settings size={16} className="text-slate-400" />
                    </button>

                    {/* User Avatar */}
                    <button
                        onClick={() => setMenuOpen(true)}
                        className="flex items-center gap-1.5 px-2 py-1 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors border border-slate-700"
                    >
                        <div className="w-5 h-5 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-[10px] font-bold text-white">
                            {(user?.name || getLegacyUserName()).charAt(0).toUpperCase()}
                        </div>
                        <span className="text-[10px] text-slate-300 font-medium hidden lg:inline">{user?.name || getLegacyUserName()}</span>
                    </button>
                </div>
            </div>

            {/* 層2: モードナビ + サブナビ */}
            <div className="bg-slate-800/95 px-4 py-1 border-b border-slate-700/30 w-full shadow-lg z-40">
                <div className="flex items-center gap-4">
                    {/* Primary Navigation Tabs */}
                    <nav className="flex items-center bg-slate-700/50 rounded-lg p-0.5 gap-0.5">
                        <NavTab
                            icon={<LayoutDashboard size={14} />}
                            label="ダッシュボード"
                            isActive={isDashboard}
                            onClick={onNavigateToDashboard}
                        />
                        <NavTab
                            icon={<FolderKanban size={14} />}
                            label="プロジェクト"
                            isActive={isProjects}
                            onClick={onNavigateToProjects}
                        />
                        <NavTab
                            icon={<CalendarDays size={14} />}
                            label="カレンダー"
                            isActive={isCalendar}
                            onClick={onNavigateToCalendar || (() => { })}
                        />
                    </nav>

                    {/* Sub Navigation (Context-Dependent) */}
                    <SubNavigation currentView={currentView} />

                    {/* Health Check (右端) */}
                    <div className="ml-auto hidden lg:block">
                        <HealthCheck />
                    </div>
                </div>
            </div>
        </div>
    );
};

// 時間プログレスバー: 1日の進行度を視覚化
const TimeProgressBar: React.FC = () => {
    const [now, setNow] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 60000);
        return () => clearInterval(timer);
    }, []);

    const hours = now.getHours();
    const minutes = now.getMinutes();
    const totalMinutes = hours * 60 + minutes;
    const dayProgress = (totalMinutes / 1440) * 100; // 0-100%

    // Color based on time of day (朝=涼しい青, 夕方=暖かいオレンジ)
    const getBarColor = () => {
        if (hours < 8) return 'bg-slate-500';
        if (hours < 12) return 'bg-emerald-500';
        if (hours < 17) return 'bg-amber-500';
        return 'bg-orange-500';
    };

    const timeStr = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;

    return (
        <div className="flex items-center gap-2">
            <div className="flex-1 h-2 bg-slate-700 rounded-full overflow-hidden relative">
                <div
                    className={`h-full ${getBarColor()} transition-all duration-1000 ease-linear`}
                    style={{ width: `${dayProgress}%` }}
                />
                {/* Current position marker */}
                <div
                    className="absolute top-0 bottom-0 w-0.5 bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)]"
                    style={{ left: `${dayProgress}%` }}
                />
            </div>
            <span className="text-xs font-mono font-bold text-slate-300 whitespace-nowrap">{timeStr}</span>
        </div>
    );
};

// フィルタボタン
const FilterButton: React.FC<{
    active: boolean;
    onClick: () => void;
    icon: React.ReactNode;
    label: string;
}> = ({ active, onClick, icon, label }) => (
    <button
        onClick={onClick}
        className={`flex items-center gap-1 px-2 py-1 text-[10px] font-bold rounded transition-all whitespace-nowrap ${active
            ? 'bg-indigo-600 text-white shadow-sm'
            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700'
            }`}
    >
        {icon}
        <span className="hidden sm:inline">{label}</span>
    </button>
);

// メインナビタブ
const NavTab: React.FC<{
    icon: React.ReactNode;
    label: string;
    isActive: boolean;
    onClick: () => void;
}> = ({ icon, label, isActive, onClick }) => (
    <button
        onClick={onClick}
        className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md transition-all ${isActive
            ? 'bg-white text-slate-900 shadow-sm'
            : 'text-slate-300 hover:text-white hover:bg-slate-600'
            }`}
    >
        <span className={isActive ? 'text-indigo-600' : 'text-slate-400'}>{icon}</span>
        <span className="hidden md:inline">{label}</span>
    </button>
);

// サブナビゲーション（モードに応じて変化）
const SubNavigation: React.FC<{ currentView: string }> = ({ currentView }) => {
    const isDashboard = currentView === 'dashboard' || currentView === 'jbwos';
    const isProjects = currentView === 'projects';
    const isCalendar = currentView === 'calendar' || currentView === 'planning';

    // Dashboard用のビューモード状態
    const [dashboardViewMode, setDashboardViewMode] = useState(() =>
        localStorage.getItem('jbwos_view_mode') || 'stream'
    );

    const handleDashboardViewChange = (mode: string) => {
        setDashboardViewMode(mode);
        localStorage.setItem('jbwos_view_mode', mode);
        window.dispatchEvent(new CustomEvent('jbwos-view-mode-change', { detail: { mode } }));
    };

    if (isDashboard) {
        return (
            <div className="flex items-center gap-1 text-[10px]">
                <span className="text-slate-500 mr-1">└</span>
                <SubNavTab label="登録と集中" isActive={dashboardViewMode === 'stream'} onClick={() => handleDashboardViewChange('stream')} />
                <SubNavTab label="全体一覧" isActive={dashboardViewMode === 'board'} onClick={() => handleDashboardViewChange('board')} />
                <SubNavTab label="全体一覧2" isActive={dashboardViewMode === 'newspaper'} onClick={() => handleDashboardViewChange('newspaper')} />
            </div>
        );
    }

    if (isProjects) {
        // プロジェクトリストでは個人/会社はフィルタで制御されるので、サブナビ不要
        return null;
    }

    if (isCalendar) {
        return (
            <div className="flex items-center gap-1 text-[10px]">
                <span className="text-slate-500 mr-1">└</span>
                <SubNavTab label="グリッド" isActive={true} onClick={() => { }} />
                <SubNavTab label="タイムライン" isActive={false} onClick={() => { }} disabled />
                <SubNavTab label="ガント" isActive={false} onClick={() => { }} disabled />
            </div>
        );
    }

    return null;
};

// サブナビタブ
const SubNavTab: React.FC<{
    label: string;
    isActive: boolean;
    onClick: () => void;
    disabled?: boolean;
}> = ({ label, isActive, onClick, disabled }) => (
    <button
        onClick={onClick}
        disabled={disabled}
        className={`px-2 py-0.5 rounded text-[10px] font-medium transition-all ${disabled
            ? 'text-slate-600 cursor-not-allowed'
            : isActive
                ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700'
            }`}
    >
        {label}
    </button>
);
