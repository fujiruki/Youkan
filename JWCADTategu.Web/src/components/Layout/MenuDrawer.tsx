import React from 'react';
import { X, Clock, Settings, Users, BookOpen, LogOut, Building, User, Wrench } from 'lucide-react';

interface AuthUser {
    id: string;
    name: string;
    email: string;
    isRepresentative?: boolean;
}

interface Tenant {
    id: string;
    name: string;
    role: string;
}

export interface MenuDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    onNavigateToToday: () => void;
    onNavigateToDashboard?: () => void;
    onNavigateToHistory?: () => void;
    onNavigateToProjects?: () => void;
    onNavigateToSettings?: () => void;
    onNavigateToCustomers?: () => void;
    onNavigateToPlanning?: () => void;
    onNavigateToManual?: () => void;
    onNavigateToCalendar?: () => void;
    onLogout: () => void;
    userName?: string;
    user?: AuthUser | null;
    tenant?: Tenant | null;
    onNavigateToCompanySettings?: () => void;
    onNavigateToPersonalSettings?: () => void;
    joinedTenants?: Tenant[];
    onSwitchTenant?: (tenantId: string | null) => void;
}

export const MenuDrawer: React.FC<MenuDrawerProps> = ({
    isOpen,
    onClose,
    onNavigateToHistory,
    onNavigateToSettings,
    onNavigateToCustomers,
    onNavigateToManual,
    onLogout,
    userName,
    user,
    tenant,
    onNavigateToCompanySettings,
    onNavigateToPersonalSettings,
    joinedTenants = [],
    onSwitchTenant
}) => {
    if (!isOpen) return null;

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/50 z-[90] animate-in fade-in duration-200"
                onClick={onClose}
            />

            {/* Side Panel */}
            <div className={`fixed top-0 bottom-0 w-72 bg-slate-50 dark:bg-slate-900 shadow-xl z-[100] flex flex-col 
                transition-transform duration-300 ease-in-out border-slate-200 dark:border-slate-800
                /* Mobile: Right Side */
                right-0 border-l animate-in slide-in-from-right
                /* Desktop: Left Side */
                md:right-auto md:left-0 md:border-l-0 md:border-r md:slide-in-from-left
            `}>
                {/* Header - User Info */}
                <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-950">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                        {/* Avatar */}
                        <div className="w-10 h-10 rounded-full bg-indigo-500 flex items-center justify-center text-lg font-bold text-white shrink-0">
                            {(user?.name || userName || 'G').charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                            {/* Tenant Info */}
                            <div className="text-xs font-medium text-indigo-600 dark:text-indigo-400 truncate">
                                {tenant ? (
                                    <span className="flex items-center gap-1">
                                        <Building size={10} />
                                        {tenant.name}
                                    </span>
                                ) : (
                                    <span className="text-slate-400">Personal Mode</span>
                                )}
                            </div>
                            {/* User Name */}
                            <div className="text-sm font-bold text-slate-900 dark:text-white truncate">
                                {user?.name || userName || 'Guest'}
                            </div>
                            {/* Email */}
                            {user?.email && (
                                <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                                    {user.email}
                                </div>
                            )}
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors shrink-0">
                        <X size={20} className="text-slate-500" />
                    </button>
                </div>

                {/* Tenant Switcher Section */}
                {onSwitchTenant && (
                    <div className="px-3 py-2 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                        <div className="px-2 pb-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">モード切替</div>
                        <div className="space-y-1">
                            {/* Personal Mode Switch */}
                            <button
                                onClick={() => { onSwitchTenant(null); onClose(); }}
                                className={`w-full flex items-center justify-between px-3 py-1.5 rounded-md text-xs transition-colors ${!tenant
                                    ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 font-bold border border-indigo-100 dark:border-indigo-900/30'
                                    : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
                                    }`}
                            >
                                <span className="flex items-center gap-2">
                                    <User size={14} />
                                    個人用 (Life)
                                </span>
                                {!tenant && <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />}
                            </button>

                            {/* Company/Proprietor Tenants */}
                            {joinedTenants.map(t => (
                                <button
                                    key={t.id}
                                    onClick={() => { onSwitchTenant(t.id); onClose(); }}
                                    className={`w-full flex items-center justify-between px-3 py-1.5 rounded-md text-xs transition-colors ${tenant?.id === t.id
                                        ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 font-bold border border-amber-100 dark:border-amber-900/30'
                                        : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
                                        }`}
                                >
                                    <span className="flex items-center gap-2">
                                        <Building size={14} />
                                        {t.name}
                                    </span>
                                    {tenant?.id === t.id && <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Content - Secondary Navigation */}
                <div className="flex-1 overflow-y-auto py-3">
                    {/* Settings Section */}
                    <MenuSection title="設定">
                        {onNavigateToPersonalSettings && !tenant && (
                            <MenuItem icon={<User size={18} />} label="個人設定" onClick={onNavigateToPersonalSettings} />
                        )}
                        {tenant && onNavigateToCompanySettings && (
                            <MenuItem icon={<Building size={18} />} label="会社設定" onClick={onNavigateToCompanySettings} />
                        )}
                        {onNavigateToSettings && (
                            <MenuItem icon={<Settings size={18} />} label="アプリ設定" onClick={onNavigateToSettings} />
                        )}
                    </MenuSection>

                    {/* Tools Section */}
                    <MenuSection title="ツール">
                        {onNavigateToHistory && (
                            <MenuItem icon={<Clock size={18} />} label="履歴" onClick={onNavigateToHistory} />
                        )}
                        {onNavigateToCustomers && (
                            <MenuItem icon={<Users size={18} />} label="顧客管理" onClick={onNavigateToCustomers} />
                        )}
                    </MenuSection>

                    {/* Help Section */}
                    <MenuSection title="ヘルプ">
                        {onNavigateToManual && (
                            <MenuItem icon={<BookOpen size={18} />} label="マニュアル" onClick={onNavigateToManual} />
                        )}
                        <MenuItem
                            icon={<Wrench size={18} />}
                            label="開発者ツール"
                            onClick={() => { console.log('[Dev Tools] Open'); }}
                            subtle
                        />
                    </MenuSection>
                </div>

                {/* Footer - Logout */}
                <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950">
                    <button
                        onClick={onLogout}
                        className="w-full flex items-center gap-2 px-4 py-2.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-lg transition-colors text-sm font-bold"
                    >
                        <LogOut size={18} />
                        ログアウト
                    </button>
                </div>
            </div>
        </>
    );
};

// Section Component
const MenuSection: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <div className="mb-4">
        <div className="px-4 py-1.5 text-xs font-bold text-slate-400 uppercase tracking-wider">
            {title}
        </div>
        <nav className="px-2 space-y-0.5">
            {children}
        </nav>
    </div>
);

// Menu Item Component
const MenuItem: React.FC<{
    icon: React.ReactNode;
    label: string;
    onClick: () => void;
    shortcut?: string;
    subtle?: boolean;
}> = ({ icon, label, onClick, shortcut, subtle }) => (
    <button
        onClick={onClick}
        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-colors group ${subtle
            ? 'text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800'
            : 'text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800'
            }`}
    >
        <div className="flex items-center gap-3">
            <span className={`transition-colors ${subtle ? 'text-slate-300' : 'text-slate-400 group-hover:text-indigo-500'}`}>
                {icon}
            </span>
            <span className="text-sm font-medium">{label}</span>
        </div>
        {shortcut && (
            <span className="text-xs text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                {shortcut}
            </span>
        )}
    </button>
);
