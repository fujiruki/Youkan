import React, { useState } from 'react';
import { JoinedTenant } from '../../types';
import { Clock, Check } from 'lucide-react';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';

interface DailyCapacityEditorProps {
    date: Date;
    joinedTenants: JoinedTenant[];
    tenantProfiles: Map<string, any>; // CapacityProfile
    onSave: (updates: { tenantId: string, minutes: number }[]) => void;
    onCancel: () => void;
}

export const DailyCapacityEditor: React.FC<DailyCapacityEditorProps> = ({
    date,
    joinedTenants,
    tenantProfiles,
    onSave,
    onCancel
}) => {
    // Initialize state with current exceptions or defaults
    const [edits, setEdits] = useState<{ [tenantId: string]: number }>(() => {
        const initial: { [tenantId: string]: number } = {};
        const dateKey = format(date, 'yyyy-MM-dd');

        joinedTenants.forEach(t => {
            const profile = tenantProfiles.get(t.id);
            if (profile?.exceptions?.[dateKey] !== undefined) {
                // Existing exception
                initial[t.id] = profile.exceptions[dateKey];
            } else {
                // Fallback to standard pattern or default
                const dayOfWeek = date.getDay();
                initial[t.id] = profile?.standardWeeklyPattern?.[dayOfWeek] ?? 480;
            }
        });
        return initial;
    });

    const handleChange = (tenantId: string, minutes: number) => {
        setEdits(prev => ({
            ...prev,
            [tenantId]: Math.max(0, Math.min(1440, minutes))
        }));
    };

    const handleSave = () => {
        const updates = Object.entries(edits).map(([tenantId, minutes]) => ({
            tenantId,
            minutes
        }));
        onSave(updates);
    };

    return (
        <div className="p-4 bg-white dark:bg-slate-800">
            <div className="flex items-center gap-2 mb-6 text-slate-700 dark:text-slate-200">
                <Clock className="w-5 h-5 text-blue-500" />
                <h3 className="text-lg font-bold">
                    {format(date, 'M月d日 (E)', { locale: ja })} の稼働設定
                </h3>
            </div>

            <div className="space-y-6">
                {joinedTenants.map(tenant => {
                    const minutes = edits[tenant.id] ?? 480;
                    const hours = (minutes / 60).toFixed(1);

                    return (
                        <div key={tenant.id} className="bg-slate-50 dark:bg-slate-700/50 p-4 rounded-lg border border-slate-100 dark:border-slate-700">
                            <div className="flex justify-between items-center mb-2">
                                <span className="font-bold text-sm text-slate-700 dark:text-slate-300">
                                    {tenant.name}
                                </span>
                                <span className="text-sm font-mono font-bold text-blue-600 dark:text-blue-400">
                                    {hours}h
                                </span>
                            </div>

                            <div className="flex items-center gap-4">
                                <div className="flex-1">
                                    <input
                                        type="range"
                                        min={0}
                                        max={720} // 12h
                                        step={30}
                                        value={minutes > 720 ? 720 : minutes}
                                        onChange={(e) => handleChange(tenant.id, parseInt(e.target.value))}
                                        className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer dark:bg-slate-600"
                                    />
                                </div>
                                <div className="w-20 relative">
                                    <input
                                        type="number"
                                        min={0}
                                        max={1440}
                                        value={minutes}
                                        onChange={(e) => handleChange(tenant.id, parseInt(e.target.value) || 0)}
                                        className="w-full p-1 border rounded text-right pr-6 dark:bg-slate-800 dark:border-slate-600 dark:text-white"
                                    />
                                    <span className="absolute right-2 top-1.5 text-xs text-slate-400">m</span>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="mt-8 flex justify-end gap-3">
                <button
                    onClick={onCancel}
                    className="px-4 py-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
                >
                    キャンセル
                </button>
                <button
                    onClick={handleSave}
                    className="flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm transition-colors"
                >
                    <Check className="w-4 h-4 mr-2" />
                    設定を保存
                </button>
            </div>
        </div>
    );
};
