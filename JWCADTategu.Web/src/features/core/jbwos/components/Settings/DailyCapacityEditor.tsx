import React, { useState } from 'react';
import { JoinedTenant, CompanyAllocation } from '../../types';
import { Clock, Check } from 'lucide-react';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import { CompanyAllocationEditor } from './CompanyAllocationEditor';

interface DailyCapacityEditorProps {
    date: Date;
    joinedTenants: JoinedTenant[];
    initialTotalMinutes?: number;
    initialAllocation?: CompanyAllocation;
    onSave: (date: Date, totalMinutes: number, allocation: CompanyAllocation) => void;
    onCancel: () => void;
}

export const DailyCapacityEditor: React.FC<DailyCapacityEditorProps> = ({
    date,
    joinedTenants,
    initialTotalMinutes = 480,
    initialAllocation = {},
    onSave,
    onCancel
}) => {
    const [totalMinutes, setTotalMinutes] = useState(initialTotalMinutes);
    const [allocation, setAllocation] = useState<CompanyAllocation>(initialAllocation);

    const handleTotalChange = (minutes: number) => {
        setTotalMinutes(Math.max(0, Math.min(1440, minutes)));
    };

    const handleSave = () => {
        onSave(date, totalMinutes, allocation);
    };

    return (
        <div className="p-4 bg-white dark:bg-slate-800 rounded-xl">
            <div className="flex items-center gap-2 mb-6 text-slate-700 dark:text-slate-200">
                <Clock className="w-5 h-5 text-indigo-500" />
                <h3 className="text-lg font-bold">
                    {format(date, 'M月d日 (E)', { locale: ja })} の稼働配分
                </h3>
            </div>

            <div className="space-y-8">
                {/* Total Capacity Section */}
                <div className="bg-slate-50 dark:bg-slate-900/50 p-5 rounded-2xl border border-slate-100 dark:border-slate-800">
                    <div className="flex justify-between items-center mb-4">
                        <label className="text-sm font-black text-slate-500 uppercase tracking-wider">
                            その日の総稼働時間
                        </label>
                        <span className="text-lg font-mono font-black text-indigo-600 dark:text-indigo-400">
                            {(totalMinutes / 60).toFixed(1)}h
                        </span>
                    </div>

                    <div className="flex items-center gap-4">
                        <input
                            type="range"
                            min={0}
                            max={720}
                            step={30}
                            value={totalMinutes > 720 ? 720 : totalMinutes}
                            onChange={(e) => handleTotalChange(parseInt(e.target.value))}
                            className="flex-1 h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                        />
                        <div className="w-24 relative">
                            <input
                                type="number"
                                min={0}
                                max={1440}
                                value={totalMinutes}
                                onChange={(e) => handleTotalChange(parseInt(e.target.value) || 0)}
                                className="w-full pl-3 pr-8 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-right font-bold text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                            />
                            <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-bold">m</span>
                        </div>
                    </div>
                </div>

                {/* Company Allocation Section (Stacked Allocator) */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between px-1">
                        <label className="text-sm font-black text-slate-500 uppercase tracking-wider">
                            会社別配分 (積み上げ)
                        </label>
                    </div>

                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-2">
                        <CompanyAllocationEditor
                            tenants={joinedTenants}
                            allocation={allocation}
                            totalAvailableMinutes={totalMinutes}
                            onChange={setAllocation}
                        />
                    </div>
                </div>
            </div>

            <div className="mt-10 flex justify-end gap-3">
                <button
                    onClick={onCancel}
                    className="px-6 py-2.5 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 font-bold transition-colors"
                >
                    キャンセル
                </button>
                <button
                    onClick={handleSave}
                    className="flex items-center px-8 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl shadow-lg shadow-indigo-200 dark:shadow-none font-bold transition-all active:scale-95"
                >
                    <Check className="w-5 h-5 mr-2" />
                    設定を適用
                </button>
            </div>
        </div>
    );
};
