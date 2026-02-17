import React from 'react';
import { Building, Target } from 'lucide-react';

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
    return (
        <div className="grid grid-cols-2 gap-4 animate-in slide-in-from-top-2 duration-300">
            <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">
                    <Building size={12} className="inline mr-1" /> 元請（顧客名）
                </label>
                <input
                    type="text"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200"
                    placeholder="株式会社〇〇"
                />
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
