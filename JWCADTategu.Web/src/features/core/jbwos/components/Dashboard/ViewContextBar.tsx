import React from 'react';
import { FilterMode, Perspective } from '../../types';

interface ViewContextBarProps {
    filterMode: FilterMode;
    onFilterChange: (mode: FilterMode) => void;
    joinedTenants: { id: string; name: string }[];
    isCompanyAccount: boolean;
    /** 現在の perspective（場面①〜④） */
    perspective: Perspective;
    perspectiveLabel: string;
}

/**
 * ヘッダー3段目に配置するフィルタ＆コンテキスト表示バー
 * 
 * レイアウト: [ フィルタボタン群 ] | [ 立場ラベル ]
 * 
 * ボタン表示ルール:
 * - 所属会社数 = 0 → フィルタ非表示
 * - 所属会社数 = 1 → [ 全て ] [ 個人 ] [ A社 ]
 * - 所属会社数 2〜4 → [ 全て ] [ 個人 ] [ 会社 ] [ A社 ] [ B社 ] ...
 * - 所属会社数 ≥ 5 → [ 全て ] [ 個人 ] [ 会社 ▼ ]（ドロップダウン）
 */
export const ViewContextBar: React.FC<ViewContextBarProps> = ({
    filterMode,
    onFilterChange,
    joinedTenants,
    isCompanyAccount: _isCompanyAccount,
    perspectiveLabel,
}) => {
    const tenantCount = joinedTenants.length;

    // No filter needed if no tenants
    if (tenantCount === 0) {
        return (
            <div className="shrink-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border-b border-slate-200/60 dark:border-slate-700/50 px-4 py-1.5 flex items-center justify-end">
                <span className="text-[10px] text-slate-400 font-medium">{perspectiveLabel}</span>
            </div>
        );
    }

    const isActive = (mode: FilterMode) => filterMode === mode;

    const btnClass = (mode: FilterMode) =>
        `px-2.5 py-1 text-[10px] font-bold rounded-md transition-all duration-150 ${isActive(mode)
            ? 'bg-indigo-600 text-white shadow-sm'
            : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700'
        }`;

    // Dropdown state for 5+ tenants
    const [showDropdown, setShowDropdown] = React.useState(false);

    const renderTenantButtons = () => {
        if (tenantCount === 1) {
            // Simple: [All] [Personal] [CompanyName]
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
            // Flat: [All] [Personal] [Company] [A社] [B社] ...
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
                        onClick={() => setShowDropdown(!showDropdown)}
                    >
                        {selectedTenant ? selectedTenant.name : '会社'}
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    </button>
                    {showDropdown && (
                        <div className="absolute top-full left-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg z-50 min-w-[140px] py-1">
                            <button
                                className="w-full text-left px-3 py-1.5 text-[10px] font-medium text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700"
                                onClick={() => { onFilterChange('company'); setShowDropdown(false); }}
                            >
                                会社（全て）
                            </button>
                            {joinedTenants.map(t => (
                                <button
                                    key={t.id}
                                    className={`w-full text-left px-3 py-1.5 text-[10px] font-medium ${filterMode === t.id ? 'text-indigo-600 bg-indigo-50 dark:bg-indigo-900/30' : 'text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700'
                                        }`}
                                    onClick={() => { onFilterChange(t.id); setShowDropdown(false); }}
                                >
                                    {t.name}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </>
        );
    };

    return (
        <div className="shrink-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border-b border-slate-200/60 dark:border-slate-700/50 px-4 py-1.5 flex items-center justify-between gap-4">
            {/* Filter Buttons */}
            <div className="flex items-center gap-1">
                {renderTenantButtons()}
            </div>

            {/* Perspective Label */}
            <span className="text-[10px] text-slate-400 font-medium whitespace-nowrap shrink-0">
                {perspectiveLabel}
            </span>
        </div>
    );
};
