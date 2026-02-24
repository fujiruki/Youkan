import React from 'react';

interface ManufacturingProjectFieldsProps {
    clientName: string;
    setClientName: (val: string) => void;
    grossProfitTarget: string;
    setGrossProfitTarget: (val: string) => void;
}

export const ManufacturingProjectFields: React.FC<ManufacturingProjectFieldsProps> = ({
    clientName,
    setClientName,
    grossProfitTarget,
    setGrossProfitTarget
}) => {
    return (
        <div className="grid grid-cols-2 gap-4">
            <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    顧客名 / 現場名
                </label>
                <input
                    type="text"
                    value={clientName}
                    onChange={e => setClientName(e.target.value)}
                    className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    placeholder="例: 田中邸"
                />
            </div>
            <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    目標粗利 (円)
                </label>
                <input
                    type="number"
                    value={grossProfitTarget}
                    onChange={e => setGrossProfitTarget(e.target.value)}
                    className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                />
            </div>
        </div>
    );
};
