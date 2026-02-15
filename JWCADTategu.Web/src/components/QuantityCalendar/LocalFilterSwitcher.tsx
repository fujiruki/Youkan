import React from 'react';

interface LocalFilterSwitcherProps {
    currentContext: string; // 'all' | 'personal' | 'company'
    onContextChange: (context: string) => void;
}

export const LocalFilterSwitcher: React.FC<LocalFilterSwitcherProps> = ({
    currentContext,
    onContextChange
}) => {
    const filters = [
        { id: 'all', label: '全て' },
        { id: 'personal', label: '個人' },
        { id: 'company', label: '会社' },
    ];

    return (
        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
            {filters.map((filter) => {
                const isActive = currentContext === filter.id;
                return (
                    <button
                        key={filter.id}
                        onClick={() => onContextChange(filter.id)}
                        className={`
                            flex-1 px-3 py-1 text-xs font-bold rounded-md transition-all
                            ${isActive
                                ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
                                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}
                        `}
                    >
                        {filter.label}
                    </button>
                );
            })}
        </div>
    );
};
