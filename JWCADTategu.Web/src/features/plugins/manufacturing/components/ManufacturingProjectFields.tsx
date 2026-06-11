import React, { useState, useRef, useEffect } from 'react';
import { Building, ChevronDown, Target } from 'lucide-react';
import { useRecentClientNames } from '../viewmodels/useRecentClientNames';

interface ManufacturingProjectFieldsProps {
    clientName: string;
    setClientName: (val: string) => void;
    grossProfitTarget: string | number;
    setGrossProfitTarget: (val: string) => void;
}

export const ManufacturingProjectFields: React.FC<ManufacturingProjectFieldsProps> = ({
    clientName,
    setClientName,
    grossProfitTarget,
    setGrossProfitTarget
}) => {
    const [open, setOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const { names, fetch } = useRecentClientNames();

    const filteredNames = clientName.trim()
        ? names.filter(n => n.includes(clientName.trim()))
        : names;

    const handleToggle = () => {
        if (!open) fetch();
        setOpen(prev => !prev);
    };

    const handleSelect = (name: string) => {
        setClientName(name);
        setOpen(false);
    };

    useEffect(() => {
        if (!open) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setOpen(false);
        };
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [open]);

    return (
        <div className="grid grid-cols-2 gap-4 animate-in slide-in-from-top-2 duration-300">
            <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">
                    <Building size={12} className="inline mr-1" /> 元請（顧客名）
                </label>
                <div className="relative" ref={containerRef}>
                    <input
                        type="text"
                        value={clientName}
                        onChange={(e) => setClientName(e.target.value)}
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 pr-8 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200"
                        placeholder="株式会社〇〇"
                    />
                    <button
                        type="button"
                        aria-label="顧客名候補を表示"
                        onClick={handleToggle}
                        className="absolute inset-y-0 right-0 flex items-center px-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    >
                        <ChevronDown size={14} />
                    </button>
                    {open && filteredNames.length > 0 && (
                        <ul className="absolute z-[200] mt-1 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl max-h-56 overflow-y-auto">
                            {filteredNames.map(name => (
                                <li
                                    key={name}
                                    onClick={() => handleSelect(name)}
                                    className="px-3 py-2 text-sm cursor-pointer text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                                >
                                    {name}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
            <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">
                    <Target size={12} className="inline mr-1" /> 目標粗利額 (円)
                </label>
                <input
                    type="number"
                    value={grossProfitTarget}
                    onChange={(e) => setGrossProfitTarget(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200"
                    placeholder="50000"
                />
            </div>
        </div>
    );
};
