import React from 'react';
import { Building2, User } from 'lucide-react';

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
    // Only use buttons if total options <= 4 (Personal + 3 companies)
    // Actually spec says "tenants <= 4" which implies Personal + 4 = 5 options?
    // Let's stick to "Personal + Tenants <= 4" for button mode to keep it clean, 
    // or maybe "Tenants <= 3" (Total 4). 
    // Spec said: "tenantsが4つ以下の場合: ボタン形式" (Tenants array length <= 4) -> Total options <= 5.
    // 5 buttons in a row might be tight on mobile. Let's try flexible wrapping or stick to max 4 total for buttons.
    // Let's interpret "tenants <= 4" literally.

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

    // Dropdown Mode (Fallback for many tenants)
    return (
        <select
            value={selectedTenantId}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none transition-all disabled:bg-slate-100 dark:disabled:bg-slate-800/50"
        >
            <option value="">👤 個人 (プライベート)</option>
            {tenants.map(t => (
                <option key={t.id} value={t.id}>🏢 {t.name}</option>
            ))}
        </select>
    );
};
