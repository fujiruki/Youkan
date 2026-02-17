import React from 'react';
import { Building2, User, ChevronDown, Check } from 'lucide-react';
import { YoukanDropdown, YoukanDropdownItem } from '../../../ui/YoukanDropdown';

interface TenantSelectorProps {
    tenants: { id: string; name: string }[];
    selectedTenantId: string;
    onChange: (tenantId: string) => void;
    disabled?: boolean;
}

export const TenantSelector: React.FC<TenantSelectorProps> = ({
    tenants,
    selectedTenantId,
    onChange,
    disabled = false
}) => {
    // Determine UI Mode based on number of options (Personal + Tenants)
    // tenants <= 4 implies Total options <= 5.
    const shouldUseButtons = tenants.length <= 4;

    if (shouldUseButtons) {
        return (
            <div className={`flex flex-wrap gap-2 ${disabled ? 'opacity-60 pointer-events-none' : ''}`}>
                {/* Personal Option */}
                <button
                    type="button"
                    onClick={() => onChange('')}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-bold transition-all ${selectedTenantId === ''
                        ? 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-500 text-indigo-700 dark:text-indigo-300 ring-1 ring-indigo-500'
                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'
                        }`}
                >
                    <User size={16} />
                    個人
                </button>

                {/* Tenant Options */}
                {tenants.map(t => (
                    <button
                        key={t.id}
                        type="button"
                        onClick={() => onChange(t.id)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-bold transition-all ${selectedTenantId === t.id
                            ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-500 text-blue-700 dark:text-blue-300 ring-1 ring-blue-500'
                            : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'
                            }`}
                    >
                        <Building2 size={16} />
                        {t.name}
                    </button>
                ))}
            </div>
        );
    }

    // Dropdown Mode (Using YoukanDropdown)
    const selectedName = selectedTenantId
        ? tenants.find(t => t.id === selectedTenantId)?.name
        : '個人 (プライベート)';

    return (
        <YoukanDropdown
            width="w-full"
            trigger={
                <div className={`w-full flex items-center justify-between px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 transition-all ${disabled ? 'opacity-60 cursor-not-allowed' : 'hover:border-indigo-400 cursor-pointer'}`}>
                    <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200 font-medium">
                        {selectedTenantId ? <Building2 size={16} className="text-blue-500" /> : <User size={16} className="text-indigo-500" />}
                        {selectedName}
                    </div>
                    <ChevronDown size={16} className="text-slate-400" />
                </div>
            }
        >
            <YoukanDropdownItem
                onClick={() => onChange('')}
                active={selectedTenantId === ''}
                className="gap-2"
            >
                <div className="flex-1 flex items-center gap-2">
                    <User size={16} className="text-indigo-500" />
                    <span>個人 (プライベート)</span>
                </div>
                {selectedTenantId === '' && <Check size={16} className="text-indigo-600" />}
            </YoukanDropdownItem>

            <div className="my-1 border-t border-slate-100 dark:border-slate-700/50" />

            {tenants.map(t => (
                <YoukanDropdownItem
                    key={t.id}
                    onClick={() => onChange(t.id)}
                    active={selectedTenantId === t.id}
                    className="gap-2"
                >
                    <div className="flex-1 flex items-center gap-2">
                        <Building2 size={16} className="text-blue-500" />
                        <span>{t.name}</span>
                    </div>
                    {selectedTenantId === t.id && <Check size={16} className="text-blue-600" />}
                </YoukanDropdownItem>
            ))}
        </YoukanDropdown>
    );
};
