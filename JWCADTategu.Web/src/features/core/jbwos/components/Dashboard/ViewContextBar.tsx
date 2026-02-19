import React from 'react';
import { FilterMode, Perspective } from '../../types';
import { User, Building2, ChevronDown } from 'lucide-react';

interface ViewContextBarProps {
    filterMode: FilterMode;
    onFilterChange: (mode: FilterMode) => void;
    joinedTenants: { id: string; name: string }[];
    isCompanyAccount: boolean;
    /** 現在の perspective（場面①〜④） */
    perspective: Perspective;
    perspectiveLabel: string;
    /** [NEW] モード切替用 */
    onModeSwitch?: (tenantId: string | null) => void;
}

/**
 * ヘッダー3段目に配置する統合コンテキストバー
 * 
 * レイアウト: [ モード切替 ] | [ フィルタボタン群 ] | [ 立場ラベル ]
 */
export const ViewContextBar: React.FC<ViewContextBarProps> = ({
    filterMode,
    onFilterChange,
    joinedTenants,
    isCompanyAccount,
    perspectiveLabel,
    onModeSwitch
}) => {
    const tenantCount = joinedTenants.length;
    const [showTenantDropdown, setShowTenantDropdown] = React.useState(false);
    const [showFilterDropdown, setShowFilterDropdown] = React.useState(false);

    const isActive = (mode: FilterMode) => filterMode === mode;

    const btnClass = (mode: FilterMode) =>
        `px-2.5 py-1 text-[10px] font-bold rounded-md transition-all duration-150 ${isActive(mode)
            ? 'bg-indigo-600 text-white shadow-sm'
            : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700'
        }`;

    const renderTenantButtons = () => {
        if (tenantCount === 0) return null;

        if (tenantCount === 1) {
            return (
                <>
                    <button className={btnClass('all')} onClick={() => onFilterChange('all')}>全て</button>
                    <button className={btnClass('personal')} onClick={() => onFilterChange('personal')}>個人</button>
                    <button className={btnClass(joinedTenants[0].id)} onClick={() => onFilterChange(joinedTenants[0].id)}>
                        {joinedTenants[0].name}
                    </button>
                </>
            );
        }

        if (tenantCount >= 2 && tenantCount <= 4) {
            return (
                <>
                    <button className={btnClass('all')} onClick={() => onFilterChange('all')}>全て</button>
                    <button className={btnClass('personal')} onClick={() => onFilterChange('personal')}>個人</button>
                    <button className={btnClass('company')} onClick={() => onFilterChange('company')}>会社</button>
                    <div className="w-px h-4 bg-slate-200 dark:bg-slate-700 mx-0.5" />
                    {joinedTenants.map(t => (
                        <button key={t.id} className={btnClass(t.id)} onClick={() => onFilterChange(t.id)}>
                            {t.name}
                        </button>
                    ))}
                </>
            );
        }

        // 5+ tenants: [All] [Personal] [Company ▼]
        const selectedTenant = joinedTenants.find(t => t.id === filterMode);
        return (
            <>
                <button className={btnClass('all')} onClick={() => onFilterChange('all')}>全て</button>
                <button className={btnClass('personal')} onClick={() => onFilterChange('personal')}>個人</button>
                <div className="relative">
                    <button
                        className={`${btnClass('company')} flex items-center gap-1`}
                        onClick={() => setShowFilterDropdown(!showFilterDropdown)}
                    >
                        {selectedTenant ? selectedTenant.name : '会社'}
                        <ChevronDown size={12} />
                    </button>
                    {showFilterDropdown && (
                        <>
                            <div className="fixed inset-0 z-40" onClick={() => setShowFilterDropdown(false)} />
                            <div className="absolute top-full left-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg z-50 min-w-[140px] py-1">
                                <button
                                    className="w-full text-left px-3 py-1.5 text-[10px] font-medium text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700"
                                    onClick={() => { onFilterChange('company'); setShowFilterDropdown(false); }}
                                >
                                    会社（全て）
                                </button>
                                {joinedTenants.map(t => (
                                    <button
                                        key={t.id}
                                        className={`w-full text-left px-3 py-1.5 text-[10px] font-medium ${filterMode === t.id ? 'text-indigo-600 bg-indigo-50 dark:bg-indigo-900/30' : 'text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700'
                                            }`}
                                        onClick={() => { onFilterChange(t.id); setShowFilterDropdown(false); }}
                                    >
                                        {t.name}
                                    </button>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            </>
        );
    };

    return (
        <div className="shrink-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-4 py-1.5 flex items-center justify-start gap-4 z-30">
            {/* Left: Mode Switcher (Moved from Hamburger) */}
            <div className="flex items-center gap-1.5 shrink-0">
                <div className="relative">
                    <button
                        onClick={() => setShowTenantDropdown(!showTenantDropdown)}
                        className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[10px] font-black transition-all border ${isCompanyAccount
                            ? 'bg-blue-600 text-white border-blue-500 shadow-sm'
                            : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700'
                            }`}
                    >
                        {isCompanyAccount ? (
                            <Building2 size={12} className="text-white/80" />
                        ) : (
                            <User size={12} className="text-indigo-500" />
                        )}
                        <span>{isCompanyAccount ? '会社モード' : '個人モード'}</span>
                        <ChevronDown size={10} className={isCompanyAccount ? 'text-white/60' : 'text-slate-400'} />
                    </button>

                    {showTenantDropdown && onModeSwitch && (
                        <>
                            <div className="fixed inset-0 z-40" onClick={() => setShowTenantDropdown(false)} />
                            <div className="absolute top-full left-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-50 min-w-[180px] py-1.5 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-200">
                                <div className="px-3 py-1.5 text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 dark:border-slate-700 mb-1">
                                    モード切替
                                </div>
                                <button
                                    onClick={() => { onModeSwitch(null); setShowTenantDropdown(false); }}
                                    className={`w-full flex items-center gap-2 px-3 py-2 text-xs font-bold ${!isCompanyAccount ? 'text-indigo-600 bg-indigo-50 dark:bg-indigo-900/30' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50'}`}
                                >
                                    <User size={14} />
                                    個人・プライベート
                                </button>
                                {joinedTenants.map(t => (
                                    <button
                                        key={t.id}
                                        onClick={() => { onModeSwitch(t.id); setShowTenantDropdown(false); }}
                                        className={`w-full flex items-center gap-2 px-3 py-2 text-xs font-bold ${isCompanyAccount ? 'text-blue-600 bg-blue-50 dark:bg-blue-900/30' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50'}`}
                                    >
                                        <Building2 size={14} />
                                        {t.name}
                                    </button>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            </div>

            <div className="w-px h-4 bg-slate-200 dark:bg-slate-800 mx-1 shrink-0" />

            {/* Middle: Filter Buttons */}
            <div className="flex items-center gap-1 flex-1 min-w-0 overflow-x-auto no-scrollbar">
                {renderTenantButtons()}
            </div>

            <div className="w-px h-4 bg-slate-200 dark:bg-slate-800 mx-1 shrink-0" />

            {/* Right Group: Perspective Label (Now on the left side of the right group) */}
            <div className="flex items-center gap-3 shrink-0">
                <span className="text-[10px] text-slate-400 font-bold whitespace-nowrap bg-slate-100 dark:bg-slate-800/50 px-2.5 py-1 rounded-full border border-slate-200/50 dark:border-slate-700/50">
                    {perspectiveLabel}
                </span>
            </div>
        </div>
    );
};
