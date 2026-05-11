import React, { useState } from 'react';
import { Filter, Check } from 'lucide-react';
import { MobileBottomSheet } from '../Common/MobileBottomSheet';
import { useFilter } from '../../contexts/FilterContext';
import { useAuth } from '@/features/core/auth/providers/AuthProvider';
import { getPerspectiveLabel } from '../../logic/perspectiveLabel';
import type { FilterMode } from '../../types';

export const MobileFilterButton: React.FC = () => {
  const { filterMode, setFilterMode } = useFilter();
  const { joinedTenants } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const currentLabel = getPerspectiveLabel(filterMode, joinedTenants);

  const options: { value: FilterMode; label: string }[] = [
    { value: 'all', label: '全て' },
    { value: 'personal', label: '個人' },
    { value: 'company', label: '会社' },
    ...joinedTenants.map(t => ({
      value: t.id as FilterMode,
      label: (t as any).title || t.name,
    })),
  ];

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-slate-400 hover:bg-slate-700 hover:text-slate-200 transition-colors max-w-[120px]"
        aria-label="フィルター"
        title="フィルター切替"
      >
        <Filter size={16} />
        <span className="text-xs font-bold truncate">{currentLabel}</span>
      </button>
      <MobileBottomSheet isOpen={isOpen} onClose={() => setIsOpen(false)} title="フィルター">
        <div className="flex flex-col py-2">
          {options.map(opt => {
            const selected = String(filterMode) === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => {
                  setFilterMode(opt.value);
                  setIsOpen(false);
                }}
                className={`flex items-center justify-between px-4 py-3 text-left text-sm font-medium transition-colors ${
                  selected
                    ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400'
                    : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <span>{opt.label}</span>
                {selected && <Check size={18} />}
              </button>
            );
          })}
        </div>
      </MobileBottomSheet>
    </>
  );
};
