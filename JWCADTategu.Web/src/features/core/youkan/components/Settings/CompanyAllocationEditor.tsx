import React from 'react';
import { CompanyAllocation } from '../../types';
import { Building2, User } from 'lucide-react';

interface CompanyAllocationEditorProps {
    tenants: { id: string; name: string }[];
    allocation: CompanyAllocation;
    totalAvailableMinutes: number;
    onChange: (allocation: CompanyAllocation) => void;
}

export const CompanyAllocationEditor: React.FC<CompanyAllocationEditorProps> = ({
    tenants,
    allocation,
    totalAvailableMinutes,
    onChange
}) => {
    const handleCompanyChange = (id: string, minutes: number) => {
        onChange({
            ...allocation,
            [id]: Math.max(0, minutes)
        });
    };

    const allocatedTotal = Object.values(allocation).reduce((sum, val) => sum + (val || 0), 0);
    const remainingMinutes = totalAvailableMinutes - allocatedTotal;
    const isOverAllocated = allocatedTotal > totalAvailableMinutes;

    return (
        <div className="space-y-4 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-slate-500 flex items-center gap-2">
                    <Building2 className="w-4 h-4" /> 会社別時間配分
                </span>
                <div className={`text-xs px-2 py-0.5 rounded-full ${isOverAllocated
                        ? 'bg-red-100 text-red-600 dark:bg-red-900/30'
                        : 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30'
                    }`}>
                    {isOverAllocated ? '枠を超過しています' : `残り自由時間: ${(remainingMinutes / 60).toFixed(1)}h`}
                </div>
            </div>

            <div className="space-y-3">
                {tenants.map(tenant => {
                    const minutes = allocation[tenant.id] || 0;
                    const hours = (minutes / 60).toFixed(1);

                    return (
                        <div key={tenant.id} className="group">
                            <div className="flex items-center justify-between mb-1">
                                <label className="text-sm text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                                    {tenant.name}
                                </label>
                                <span className="text-xs font-mono text-slate-500">{hours}h</span>
                            </div>
                            <input
                                type="range"
                                min={0}
                                max={Math.max(720, totalAvailableMinutes)}
                                step={30}
                                value={minutes}
                                onChange={(e) => handleCompanyChange(tenant.id, parseInt(e.target.value))}
                                className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                            />
                        </div>
                    );
                })}

                {/* Private/Life Time Indicator */}
                <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
                    <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-400 flex items-center gap-1.5">
                            <User className="w-3 h-3" /> プライベート / 自由時間
                        </span>
                        <span className={`text-xs font-mono ${remainingMinutes < 0 ? 'text-red-500' : 'text-slate-400'}`}>
                            {(remainingMinutes / 60).toFixed(1)}h
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
};
