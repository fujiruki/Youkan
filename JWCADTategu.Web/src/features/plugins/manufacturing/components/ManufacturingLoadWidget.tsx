import React from 'react';
import { Hammer, Truck, Clock } from 'lucide-react';
import { useDashboardViewModel } from '../viewmodels/useDashboardViewModel';

export const ManufacturingLoadWidget: React.FC = () => {
    const { dailyTotalFabricationTime, dailyTotalSiteTime, loading, error } = useDashboardViewModel();

    if (loading) return null;
    if (error) return <div className="text-[10px] text-rose-400">Error loading mfg data</div>;

    const totalMinutes = dailyTotalFabricationTime + dailyTotalSiteTime;
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;

    return (
        <div className="bg-white/80 backdrop-blur-sm border border-slate-200 rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                    <Clock size={14} className="text-indigo-500" />
                    本日の製造負荷
                </h3>
                <span className="text-sm font-mono font-bold text-slate-700">
                    {hours}h {mins}m
                </span>
            </div>

            <div className="space-y-3">
                {/* Fabrication Time */}
                <div>
                    <div className="flex justify-between text-[10px] mb-1">
                        <span className="text-slate-400 flex items-center gap-1">
                            <Hammer size={12} /> 製作時間
                        </span>
                        <span className="font-mono text-slate-500">{dailyTotalFabricationTime} min</span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-indigo-400 transition-all duration-700 ease-out"
                            style={{ width: `${Math.min(100, (dailyTotalFabricationTime / 480) * 100)}%` }}
                        />
                    </div>
                </div>

                {/* Site Time */}
                <div>
                    <div className="flex justify-between text-[10px] mb-1">
                        <span className="text-slate-400 flex items-center gap-1">
                            <Truck size={12} /> 現場時間
                        </span>
                        <span className="font-mono text-slate-500">{dailyTotalSiteTime} min</span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-emerald-400 transition-all duration-700 ease-out"
                            style={{ width: `${Math.min(100, (dailyTotalSiteTime / 480) * 100)}%` }}
                        />
                    </div>
                </div>
            </div>

            <div className="mt-3 pt-3 border-t border-slate-100">
                <p className="text-[9px] text-slate-400 leading-tight">
                    ※ 今日やるタスクに紐づく製造データの合計です。
                </p>
            </div>
        </div>
    );
};
