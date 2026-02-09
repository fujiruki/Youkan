
import React, { useState, useEffect } from 'react';
import { Menu, LayoutDashboard, FolderKanban, CalendarDays, User, Settings, Plus, Building2 } from 'lucide-react';
import { HealthCheck } from '../../features/core/jbwos/components/Layout/HealthCheck';

import { MenuDrawer } from './MenuDrawer';
import { MotivatorWhisper } from '../../features/core/jbwos/components/Layout/MotivatorWhisper';


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
    // Optional load info
    usedMinutes?: number;
    limitMinutes?: number;
    activeProject?: any | null; // [NEW] Active project context
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
    onSwitchTenant,
    usedMinutes: initialUsed = 0,
    limitMinutes: initialLimit = 480,
    activeProject // [NEW] Read active project
}) => {
    const [menuOpen, setMenuOpen] = useState(false);
    const [filterMode, setFilterMode] = useState<FilterMode>(() => {
        const saved = localStorage.getItem('jbwos_global_filter');
        return (saved as FilterMode) || 'all';
    });

    const [capacity, setCapacity] = useState({ used: initialUsed, limit: initialLimit });

    // Dashboard用のビューモード状態
    const [dashboardViewMode, setDashboardViewMode] = useState(() =>
        localStorage.getItem('jbwos_view_mode') || 'stream'
    );

    // プロジェクト画面用のビューモード状態
    const [projectViewMode, setProjectViewMode] = useState(() =>
        localStorage.getItem('jbwos_project_view_mode') || 'grid'
    );

    // Persist filter mode
    useEffect(() => {
        localStorage.setItem('jbwos_global_filter', filterMode);
        window.dispatchEvent(new CustomEvent('jbwos-filter-change', { detail: { mode: filterMode } }));
    }, [filterMode]);

    // Listen for updates from screens
    useEffect(() => {
        const handleViewModeChange = (e: any) => {
            const mode = e.detail?.mode;
            if (mode) setDashboardViewMode(mode);
        };
        const handleCapacityUpdate = (e: any) => {
            if (e.detail) {
                setCapacity({
                    used: e.detail.used ?? capacity.used,
                    limit: e.detail.limit ?? capacity.limit
                });
            }
        };
        const handleProjectViewModeChange = (e: any) => {
            const mode = e.detail?.mode;
            if (mode) setProjectViewMode(mode);
        };
        window.addEventListener('jbwos-view-mode-change', handleViewModeChange as EventListener);
        window.addEventListener('jbwos-capacity-update', handleCapacityUpdate as EventListener);
        window.addEventListener('jbwos-project-view-mode-change', handleProjectViewModeChange as EventListener);
        return () => {
            window.removeEventListener('jbwos-view-mode-change', handleViewModeChange as EventListener);
            window.removeEventListener('jbwos-capacity-update', handleCapacityUpdate as EventListener);
            window.removeEventListener('jbwos-project-view-mode-change', handleProjectViewModeChange as EventListener);
        };
    }, [capacity]);

    const getLegacyUserName = () => {
        try {
            const u = JSON.parse(localStorage.getItem('jbwos_user') || '{}');
            return u.name || 'User';
        } catch { return 'User'; }
    };

    const handleDashboardViewChange = (mode: string) => {
        setDashboardViewMode(mode);
        localStorage.setItem('jbwos_view_mode', mode);
        window.dispatchEvent(new CustomEvent('jbwos-view-mode-change', { detail: { mode } }));
    };

    const handleProjectViewChange = (mode: string) => {
        setProjectViewMode(mode);
        localStorage.setItem('jbwos_project_view_mode', mode);
        window.dispatchEvent(new CustomEvent('jbwos-project-view-mode-change', { detail: { mode } }));
    };

    // Check active states
    const isDashboard = currentView === 'dashboard' || currentView === 'jbwos';
    const isProjects = currentView === 'projects';
    const isCalendar = currentView === 'calendar' || currentView === 'planning';

    return (
        <div className="flex flex-col shrink-0 w-full relative select-none">
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

            {/* 層1: グローバルバー (Global Bar) - センタリングレイアウト */}
            <div className="bg-slate-900 px-4 py-1.5 flex items-center border-b border-slate-700/50 w-full z-40 relative h-10">

                {/* Left: Menu */}
                <div className="flex items-center gap-2 shrink-0">
                    <button
                        onClick={() => setMenuOpen(true)}
                        className="p-1.5 hover:bg-slate-700 rounded-lg transition-colors border border-slate-700/50"
                        title="メニュー"
                    >
                        <Menu size={18} className="text-slate-300" />
                    </button>
                    <HealthCheck />
                </div>

                {/* Center: 集約コントロール */}
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-6 w-full max-w-[1000px] justify-center">

                    {/* [NEW] Project Focused Label */}
                    {activeProject && (
                        <div className="flex items-center gap-1.5 px-3 py-1 bg-indigo-600/20 rounded-lg border border-indigo-500/30 animate-in fade-in slide-in-from-top-2 duration-300">
                            <div className="flex flex-col">
                                <span className="text-[7px] font-black text-indigo-400 uppercase tracking-tighter leading-none">Project Focused</span>
                                <span className="text-[11px] font-black text-white leading-tight truncate max-w-[180px]">
                                    {activeProject.title || activeProject.name}
                                </span>
                            </div>
                            <button
                                onClick={onNavigateToDashboard}
                                className="ml-1 p-0.5 hover:bg-indigo-500/40 rounded transition-colors text-indigo-300 hover:text-white"
                                title="解除"
                            >
                                <Plus size={14} className="rotate-45" />
                            </button>
                        </div>
                    )}

                    {/* Logo */}
                    <button
                        onClick={onNavigateToDashboard}
                        className="flex items-center gap-1 hover:opacity-80 transition-opacity"
                    >
                        <span className="text-lg">⚡</span>
                        <span className="text-sm font-black text-slate-100 italic tracking-tighter">JBWOS</span>
                    </button>

                    {/* Time Progress */}
                    <div className="w-40">
                        <TimeProgressBar />
                    </div>

                    {/* Motivator Whisper */}
                    <MotivatorWhisper />

                    {/* Reality Load (TOTAL LOAD) */}
                    <div className="flex items-center gap-2 px-3 py-1 bg-slate-800/50 rounded border border-slate-700/50">
                        <div className="flex flex-col">
                            <span className="text-[7px] font-black text-indigo-400 uppercase tracking-tighter leading-none">Reality (Total Load)</span>
                            <div className="flex items-baseline gap-1">
                                <span className="text-xs font-black text-slate-100 font-mono leading-none">{capacity.used}</span>
                                <span className="text-[8px] text-slate-500 font-bold leading-none">/ {capacity.limit} min</span>
                                <span className="text-[8px] text-indigo-500 font-bold leading-none">({Math.round((capacity.used / capacity.limit) * 100)}%)</span>
                            </div>
                        </div>
                        <div className="w-20 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                            <div
                                className={`h-full transition-all duration-500 ${capacity.used > capacity.limit ? 'bg-red-500' : 'bg-indigo-500'}`}
                                style={{ width: `${Math.min(100, (capacity.used / capacity.limit) * 100)}%` }}
                            />
                        </div>
                    </div>

                    {/* Filter */}
                    <div className="flex items-center gap-1.5 pl-2 border-l border-slate-700/50">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">フィルタ</span>
                        <div className="flex items-center bg-slate-800 p-0.5 rounded-md border border-slate-700">
                            <FilterButton active={filterMode === 'all'} onClick={() => setFilterMode('all')} label="全て" />
                            <FilterButton active={filterMode === 'personal'} onClick={() => setFilterMode('personal')} label="個人" />
                            <FilterButton active={filterMode === 'company'} onClick={() => setFilterMode('company')} label="会社" />
                        </div>
                    </div>
                </div>


                {/* Right: User & Setting */}
                <div className="flex items-center gap-2 shrink-0 ml-auto">
                    <button
                        onClick={onNavigateToSettings}
                        className="p-1.5 hover:bg-slate-700 rounded-lg transition-colors text-slate-400"
                        title="設定"
                    >
                        <Settings size={16} />
                    </button>

                    {/* アカウント表示 (👤アイコン) */}
                    <button
                        onClick={() => setMenuOpen(true)}
                        className="flex items-center gap-2 pl-1 pr-2 py-1 bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 transition-colors"
                    >
                        <div className="w-5 h-5 rounded bg-indigo-500 flex items-center justify-center text-white shrink-0">
                            {tenant ? <Building2 size={12} fill="currentColor" /> : <User size={12} fill="currentColor" />}
                        </div>
                        <span className="text-[11px] text-slate-200 font-bold whitespace-nowrap truncate max-w-[120px]">
                            {tenant ? tenant.name : (user?.name || getLegacyUserName())}
                        </span>
                    </button>
                </div>
            </div>

            {/* 層2: ナビゲーションバー (Navigation Bar) - 構造化ナビゲーションバー (垂直区切り) */}
            <div className="bg-slate-800 text-slate-300 px-6 py-2 border-b border-slate-700/50 w-full shadow-xl z-40 overflow-x-auto no-scrollbar">
                <div className="flex items-stretch gap-0 min-w-max">

                    {/* ダッシュボード Section */}
                    <NavSection title="ダッシュボード" isActive={isDashboard} icon={<LayoutDashboard size={14} />}>
                        <div className="flex gap-1">
                            <SubNavTab label="登録と集中" isActive={isDashboard && dashboardViewMode === 'stream'} onClick={() => { onNavigateToDashboard(); handleDashboardViewChange('stream'); }} />
                            <SubNavTab label="全体一覧" isActive={isDashboard && dashboardViewMode === 'board'} onClick={() => { onNavigateToDashboard(); handleDashboardViewChange('board'); }} />
                            <SubNavTab label="全体一覧2" isActive={isDashboard && dashboardViewMode === 'newspaper'} onClick={() => { onNavigateToDashboard(); handleDashboardViewChange('newspaper'); }} />
                        </div>
                    </NavSection>

                    <Separator />

                    {/* プロジェクト Section */}
                    <NavSection title="プロジェクト" isActive={isProjects} icon={<FolderKanban size={14} />}>
                        <div className="flex gap-1 items-center">
                            <SubNavTab label="個人" isActive={isProjects && filterMode === 'personal'} onClick={() => { onNavigateToProjects(); setFilterMode('personal'); }} />
                            <SubNavTab label="会社" isActive={isProjects && filterMode === 'company'} onClick={() => { onNavigateToProjects(); setFilterMode('company'); }} />

                            {isProjects && (
                                <div className="flex items-center bg-slate-900/50 p-0.5 rounded ml-2 border border-slate-700/50">
                                    <button
                                        onClick={() => handleProjectViewChange('grid')}
                                        className={`px-2 py-1 rounded text-[10px] font-bold transition-all ${projectViewMode === 'grid' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
                                    >
                                        グリッド
                                    </button>
                                    <button
                                        onClick={() => handleProjectViewChange('list')}
                                        className={`px-2 py-1 rounded text-[10px] font-bold transition-all ${projectViewMode === 'list' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
                                    >
                                        リスト
                                    </button>
                                </div>
                            )}
                        </div>
                    </NavSection>

                    <Separator />

                    {/* カレンダー Section */}
                    <NavSection title="カレンダー" isActive={isCalendar} icon={<CalendarDays size={14} />}>
                        <div className="flex gap-1">
                            <SubNavTab label="グリッド" isActive={isCalendar} onClick={() => onNavigateToCalendar?.()} />
                            <SubNavTab label="タイムライン" isActive={false} onClick={() => { }} disabled />
                            <SubNavTab label="ガント" isActive={false} onClick={() => { }} disabled />
                        </div>
                    </NavSection>

                    {/* Right Action: 新プロジェクト */}
                    <div className="ml-auto pl-8 flex items-center">
                        <button
                            onClick={() => window.dispatchEvent(new CustomEvent('jbwos-open-project-modal'))}
                            className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg shadow-lg shadow-indigo-500/20 transition-all font-bold text-xs ring-1 ring-white/10"
                        >
                            <Plus size={16} strokeWidth={3} />
                            <span>新プロジェクト</span>
                        </button>
                    </div>

                </div>
            </div>
        </div>
    );
};

// ナビゲーションセクション (垂直構造)
const NavSection: React.FC<{
    title: string;
    isActive: boolean;
    icon: React.ReactNode;
    children: React.ReactNode;
}> = ({ title, isActive, icon, children }) => (
    <div className={`px-6 flex flex-col gap-1.5 transition-opacity ${isActive ? 'opacity-100' : 'opacity-60 hover:opacity-100'}`}>
        <div className={`flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.2em] ${isActive ? 'text-indigo-400' : 'text-slate-400'}`}>
            {icon}
            <span>{title}</span>
        </div>
        <div>{children}</div>
    </div>
);

// セパレーター (|)
const Separator = () => <div className="w-[1px] bg-slate-700/50 my-1 mx-2" />;

// 時間プログレスバー (目盛り付き)
const TimeProgressBar: React.FC = () => {
    const [now, setNow] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 60000);
        return () => clearInterval(timer);
    }, []);

    const hours = now.getHours();
    const minutes = now.getMinutes();
    const totalMinutes = hours * 60 + minutes;
    const dayProgress = (totalMinutes / 1440) * 100;

    const barColor = hours < 8 ? 'bg-slate-500' : hours < 12 ? 'bg-emerald-500' : hours < 17 ? 'bg-amber-500' : 'bg-orange-500';
    const timeStr = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;

    return (
        <div className="flex flex-col gap-0.5">
            {/* Scale Labels */}
            <div className="flex justify-between text-[7px] font-bold text-slate-500 px-[1px]">
                <span>0</span>
                <span className="translate-x-1">12</span>
                <span>24</span>
            </div>
            {/* Progress Bar Container */}
            <div className="flex items-center gap-2">
                <div className="flex-1 h-3 bg-slate-800 rounded-sm overflow-hidden relative border border-slate-700">
                    <div
                        className={`h-full ${barColor} transition-all duration-1000 ease-linear opacity-80`}
                        style={{ width: `${dayProgress}%` }}
                    />
                    {/* Tick marks */}
                    <div className="absolute inset-0 flex justify-around px-[1px] pointer-events-none">
                        <div className="h-full w-[1px] bg-slate-700/30" />
                        <div className="h-full w-[1px] bg-slate-700/30" />
                    </div>
                    {/* Current position */}
                    <div
                        className="absolute top-0 bottom-0 w-[1px] bg-white z-10"
                        style={{ left: `${dayProgress}%` }}
                    />
                </div>
                <span className="text-[10px] font-mono font-black text-slate-400">{timeStr}</span>
            </div>
        </div>
    );
};

// フィルタボタン (コンパクト)
const FilterButton: React.FC<{
    active: boolean;
    onClick: () => void;
    label: string;
}> = ({ active, onClick, label }) => (
    <button
        onClick={onClick}
        className={`px-2 h-5 flex items-center justify-center text-[10px] font-black rounded transition-all ${active
            ? 'bg-indigo-600 text-white shadow-sm'
            : 'text-slate-500 hover:text-slate-300 hover:bg-slate-700'
            }`}
    >
        {label}
    </button>
);

// サブナビタブ (1クリックで遷移可能)
const SubNavTab: React.FC<{
    label: string;
    isActive: boolean;
    onClick: () => void;
    disabled?: boolean;
}> = ({ label, isActive, onClick, disabled }) => (
    <button
        onClick={onClick}
        disabled={disabled}
        className={`px-3 py-1.5 rounded-md text-[11px] font-bold transition-all border ${disabled
            ? 'text-slate-600 border-transparent cursor-not-allowed'
            : isActive
                ? 'bg-indigo-500/10 text-indigo-300 border-indigo-500/30 shadow-[0_0_15px_rgba(99,102,241,0.1)]'
                : 'text-slate-400 border-transparent hover:text-slate-200 hover:bg-slate-700/50'
            }`}
    >
        {label}
    </button>
);
