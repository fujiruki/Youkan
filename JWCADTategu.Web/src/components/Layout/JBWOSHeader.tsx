
import React, { useState, useEffect } from 'react';
import { Menu, LayoutDashboard, FolderKanban, CalendarDays, User, Settings, Plus, Building2 } from 'lucide-react';
import { HealthCheck } from '../../features/core/jbwos/components/Layout/HealthCheck';

import { MenuDrawer } from './MenuDrawer';
import { MotivatorWhisper } from '../../features/core/jbwos/components/Layout/MotivatorWhisper';
import { ViewContextBar } from '../../features/core/jbwos/components/Dashboard/ViewContextBar';
import { calculatePerspective } from '../../features/core/jbwos/logic/perspective';
import { JoinedTenant, FilterMode } from '../../features/core/jbwos/types';
import { YOUKAN_KEYS, YOUKAN_EVENTS } from '../../features/core/session/youkanKeys';


// Basic types needed for props
interface AuthUser {
	id: string;
	name: string;
	email: string;
}

interface Tenant {
	id: string;
	name: string;
	title?: string;
	role: string;
	representativeName?: string;
	representativeEmail?: string;
}

// type FilterMode = 'all' | 'personal' | 'company'; // [REMOVED] Use from types.ts

interface JBWOSHeaderProps {
	currentView: 'jbwos' | 'today' | 'history' | 'settings' | 'customers' | 'companySettings' | 'dashboard' | 'userlist' | 'projects' | 'calendar' | 'planning' | 'personalSettings' | 'archive' | 'trash';
	onNavigateToToday: () => void;
	onNavigateToDashboard: () => void;
	onNavigateToHistory: () => void;
	onNavigateToProjects: (scope?: 'personal' | 'company') => void;
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
	onClearProject?: () => void; // [NEW] Clear project focus
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
	onClearProject,
	usedMinutes: initialUsed = 0,
	limitMinutes: initialLimit = 100,
	activeProject // [NEW] Read active project
}) => {
	const [menuOpen, setMenuOpen] = useState(false);
	const [filterMode, setFilterMode] = useState<FilterMode>(() => {
		const saved = localStorage.getItem(YOUKAN_KEYS.FILTER_MODE);
		return (saved as FilterMode) || 'all';
	});

	const [hideCompleted] = useState(() => {
		return localStorage.getItem(YOUKAN_KEYS.HIDE_COMPLETED) === 'true';
	});

	const [capacity, setCapacity] = useState({ used: initialUsed, limit: initialLimit });

	// Dashboard用のビューモード状態
	const [dashboardViewMode, setDashboardViewMode] = useState(() =>
		localStorage.getItem(YOUKAN_KEYS.VIEW_MODE) || 'stream'
	);

	// プロジェクト画面用のビューモード状態
	const [projectViewMode, setProjectViewMode] = useState(() =>
		localStorage.getItem(YOUKAN_KEYS.PROJECT_VIEW_MODE) || 'grid'
	);

	// カレンダー画面用のビューモード状態
	const [calendarViewMode, setCalendarViewMode] = useState(() =>
		localStorage.getItem(YOUKAN_KEYS.CALENDAR_VIEW_MODE) || 'gantt'
	);

	// [NEW] 【宣言的同期】テナント（モード）が切り替わった場合、それに対応するフィルタモードを自動設定する
	useEffect(() => {
		if (tenant?.id) {
			// 特定テナント（A社等）へ切り替わった場合、そのテナントをフィルタ対象にする
			setFilterMode(tenant.id as FilterMode);
		} else {
			// 個人（プライベート）へ切り替わった場合、デフォルトで 'personal' に設定
			setFilterMode('personal');
		}
	}, [tenant?.id]);

	// Persist filter mode & hideCompleted
	useEffect(() => {
		localStorage.setItem(YOUKAN_KEYS.FILTER_MODE, filterMode);
		localStorage.setItem(YOUKAN_KEYS.HIDE_COMPLETED, String(hideCompleted));
		window.dispatchEvent(new CustomEvent(YOUKAN_EVENTS.FILTER_CHANGE, {
			detail: { mode: filterMode, hideCompleted }
		}));
	}, [filterMode, hideCompleted]);

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
		const handleCalendarViewModeChange = (e: any) => {
			const mode = e.detail?.mode;
			if (mode) setCalendarViewMode(mode);
		};
		const handleFilterChange = (e: any) => {
			const mode = e.detail?.mode;
			if (mode === 'all' || mode === 'personal' || mode === 'company') {
				setFilterMode(mode);
			}
		};
		window.addEventListener(YOUKAN_EVENTS.VIEW_MODE_CHANGE, handleViewModeChange as EventListener);
		window.addEventListener(YOUKAN_EVENTS.CAPACITY_UPDATE, handleCapacityUpdate as EventListener);
		window.addEventListener(YOUKAN_EVENTS.PROJECT_VIEW_MODE_CHANGE, handleProjectViewModeChange as EventListener);
		window.addEventListener(YOUKAN_EVENTS.CALENDAR_VIEW_MODE_CHANGE, handleCalendarViewModeChange as EventListener);
		window.addEventListener(YOUKAN_EVENTS.FILTER_CHANGE, handleFilterChange as EventListener);
		return () => {
			window.removeEventListener(YOUKAN_EVENTS.VIEW_MODE_CHANGE, handleViewModeChange as EventListener);
			window.removeEventListener(YOUKAN_EVENTS.CAPACITY_UPDATE, handleCapacityUpdate as EventListener);
			window.removeEventListener(YOUKAN_EVENTS.PROJECT_VIEW_MODE_CHANGE, handleProjectViewModeChange as EventListener);
			window.removeEventListener(YOUKAN_EVENTS.CALENDAR_VIEW_MODE_CHANGE, handleCalendarViewModeChange as EventListener);
			window.removeEventListener(YOUKAN_EVENTS.FILTER_CHANGE, handleFilterChange as EventListener);
		};
	}, [capacity, filterMode]);

	const isCompanyAccount = (user?.id?.length || 0) > 20;
	const { perspective, perspectiveLabel } = calculatePerspective(
		isCompanyAccount,
		filterMode as any,
		joinedTenants as JoinedTenant[]
	);

	const getLegacyUserName = () => {
		try {
			const u = JSON.parse(localStorage.getItem(YOUKAN_KEYS.USER) || '{}');
			return u.name || 'User';
		} catch { return 'User'; }
	};

	const handleDashboardViewChange = (mode: string) => {
		setDashboardViewMode(mode);
		localStorage.setItem(YOUKAN_KEYS.VIEW_MODE, mode);
		window.dispatchEvent(new CustomEvent(YOUKAN_EVENTS.VIEW_MODE_CHANGE, { detail: { mode } }));
	};

	const handleProjectViewChange = (mode: string) => {
		setProjectViewMode(mode);
		localStorage.setItem(YOUKAN_KEYS.PROJECT_VIEW_MODE, mode);
		window.dispatchEvent(new CustomEvent(YOUKAN_EVENTS.PROJECT_VIEW_MODE_CHANGE, { detail: { mode } }));
	};

	const handleCalendarViewChange = (mode: string) => {
		setCalendarViewMode(mode);
		localStorage.setItem(YOUKAN_KEYS.CALENDAR_VIEW_MODE, mode);
		window.dispatchEvent(new CustomEvent(YOUKAN_EVENTS.CALENDAR_VIEW_MODE_CHANGE, { detail: { mode } }));
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
					localStorage.removeItem(YOUKAN_KEYS.TOKEN);
					localStorage.removeItem(YOUKAN_KEYS.USER);
					window.location.href = './';
				}}
				userName={user?.name || getLegacyUserName()}
				user={user}
				tenant={tenant}
				joinedTenants={joinedTenants}
				onSwitchTenant={onSwitchTenant}
			/>

			{/* 層1: グローバルバー (Global Bar) - Flexboxレイアウト */}
			<div className="bg-slate-900 px-4 py-1.5 flex items-center justify-between border-b border-slate-700/50 w-full z-40 relative h-10 gap-4">

				{/* Left: Menu & Mobile Logo */}
				<div className="flex items-center gap-2 shrink-0">
					<button
						onClick={() => setMenuOpen(true)}
						className="p-1.5 hover:bg-slate-700 rounded-lg transition-colors border border-slate-700/50"
						title="メニュー"
					>
						<Menu size={18} className="text-slate-300" />
					</button>

					{/* Mobile Logo (Icon Only) */}
					<button
						onClick={onNavigateToDashboard}
						className="md:hidden flex items-center text-slate-100 hover:opacity-80 transition-opacity"
					>
						<span className="text-lg">⚡</span>
					</button>

					<HealthCheck />
				</div>

				{/* Center: 集約コントロール (Desktop Only) - 脱Absolute */}
				<div className="hidden md:flex items-center gap-6 justify-center flex-1 min-w-0">

					{/* [NEW] Project Focused Label */}
					{activeProject && (
						<div className="flex items-center gap-1.5 px-3 py-1 bg-indigo-600/20 rounded-lg border border-indigo-500/30 animate-in fade-in slide-in-from-top-2 duration-300 shrink-0">
							<div className="flex flex-col">
								<span className="text-[7px] font-black text-indigo-400 uppercase tracking-tighter leading-none">Project Focused</span>
								<span className="text-[11px] font-black text-white leading-tight truncate max-w-[150px] lg:max-w-[200px]">
									{activeProject.title || activeProject.name}
								</span>
							</div>
							<button
								onClick={onClearProject || onNavigateToDashboard}
								className="ml-1 p-0.5 hover:bg-indigo-500/40 rounded transition-colors text-indigo-300 hover:text-white"
								title="解除"
							>
								<Plus size={14} className="rotate-45" />
							</button>
						</div>
					)}

					{/* Logo (Desktop) */}
					<button
						onClick={onNavigateToDashboard}
						className="flex items-center gap-1 hover:opacity-80 transition-opacity shrink-0"
					>
						<span className="text-lg">⚡</span>
						<span className="text-sm font-black text-slate-400 italic tracking-tighter">Youkan</span>
					</button>

					{/* Time Progress */}
					<div className="w-32 lg:w-40 shrink-0">
						<TimeProgressBar />
					</div>

					{/* Motivator Whisper */}
					<div className="hidden lg:block shrink-0">
						<MotivatorWhisper />
					</div>

					{/* Reality Load (TOTAL LOAD) */}
					<div className="flex items-center gap-2 px-3 py-1 bg-slate-800/50 rounded border border-slate-700/50 shrink-0">
						<div className="flex flex-col">
							<span className="text-[7px] font-black text-indigo-400 uppercase tracking-tighter leading-none">Reality (Total Load)</span>
							<div className="flex items-baseline gap-1">
								<span className="text-xs font-black text-slate-100 font-mono leading-none">{capacity.used}</span>
								<span className="text-[8px] text-slate-500 font-bold leading-none">/ {capacity.limit} min</span>
								<span className="text-[8px] text-indigo-500 font-bold leading-none">({Math.round((capacity.used / capacity.limit) * 100)}%)</span>
							</div>
						</div>
						<div className="w-16 lg:w-20 h-1.5 bg-slate-700 rounded-full overflow-hidden">
							<div
								className={`h-full transition-all duration-500 ${capacity.used > capacity.limit ? 'bg-red-500' : 'bg-indigo-500'}`}
								style={{ width: `${Math.min(100, (capacity.used / capacity.limit) * 100)}%` }}
							/>
						</div>
					</div>
				</div>


				{/* Right: User & Setting */}
				<div className="flex items-center gap-2 shrink-0">
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

			{/* 層2: ナビゲーションバー (Navigation Bar) */}
			<div className="bg-slate-800 text-slate-300 px-6 py-2 border-b border-slate-700/50 w-full shadow-xl z-40 relative">
				<div className="flex flex-wrap items-center justify-between gap-y-2">

					{/* Left: Navigations */}
					<div className="flex items-stretch gap-0 overflow-x-auto no-scrollbar">

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
								<SubNavTab label="個人" isActive={isProjects && filterMode === 'personal'} onClick={() => onNavigateToProjects('personal')} />
								<SubNavTab label="会社" isActive={isProjects && filterMode === 'company'} onClick={() => onNavigateToProjects('company')} />

								{isProjects && (
									<div className="flex items-center bg-slate-900/50 p-0.5 rounded ml-2 border border-slate-700/50 hidden md:flex">
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

						<NavSection title="カレンダー" isActive={isCalendar} icon={<CalendarDays size={14} />}>
							<div className="flex gap-1">
								<SubNavTab label="グリッド" isActive={isCalendar && calendarViewMode === 'grid'} onClick={() => { onNavigateToCalendar?.(); handleCalendarViewChange('grid'); }} />
								<SubNavTab label="タイムライン" isActive={isCalendar && calendarViewMode === 'timeline'} onClick={() => { onNavigateToCalendar?.(); handleCalendarViewChange('timeline'); }} />
								<SubNavTab label="ガント" isActive={isCalendar && calendarViewMode === 'gantt'} onClick={() => { onNavigateToCalendar?.(); handleCalendarViewChange('gantt'); }} />
							</div>
						</NavSection>
					</div>

					{/* Right Combined Group: Actions Only (Filter moved to ViewContextBar) */}
					<div className="flex items-center gap-4 ml-auto pl-2">
						{/* Right Action: 新プロジェクト */}
						<div className="flex items-center">
							<button
								onClick={() => window.dispatchEvent(new CustomEvent(YOUKAN_EVENTS.OPEN_PROJECT_MODAL))}
								className="flex items-center gap-1.5 px-3 md:px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg shadow-lg shadow-indigo-500/20 transition-all font-bold text-xs ring-1 ring-white/10"
							>
								<Plus size={16} strokeWidth={3} />
								<span className="hidden md:inline">新プロジェクト</span>
							</button>
						</div>
					</div>

				</div>
			</div>

			{/* 層3: 統合コンテキストバー */}
			<ViewContextBar
				filterMode={filterMode as any}
				onFilterChange={(mode: any) => setFilterMode(mode as any)}
				joinedTenants={joinedTenants as any}
				isCompanyAccount={isCompanyAccount}
				perspective={perspective}
				perspectiveLabel={activeProject?.title || perspectiveLabel}
				onModeSwitch={onSwitchTenant}
			/>
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
	<div className={`px-2 md:px-6 flex flex-col gap-1.5 transition-opacity ${isActive ? 'opacity-100' : 'opacity-60 hover:opacity-100'}`}>
		<div className={`hidden md:flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.2em] ${isActive ? 'text-indigo-400' : 'text-slate-400'}`}>
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
