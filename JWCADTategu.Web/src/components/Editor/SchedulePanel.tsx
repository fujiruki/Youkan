import React from 'react';
import { Door } from '../../db/db';
import { Calendar, Clock, BarChart } from 'lucide-react';

interface SchedulePanelProps {
    door: Door;
    onChange: (updates: Partial<Door>) => void;
}

export const SchedulePanel: React.FC<SchedulePanelProps> = ({ door, onChange }) => {
    // Helper to format date for input
    const formatDate = (d?: Date) => d ? d.toISOString().split('T')[0] : '';

    // Helper to parse date from input
    const parseDate = (s: string) => s ? new Date(s) : undefined;

    return (
        <div className="p-4 text-slate-300">
            <h3 className="font-bold mb-4 flex items-center gap-2 text-emerald-400">
                <Calendar size={18} />
                Schedule & Man-Hours
            </h3>

            <div className="space-y-6">
                {/* Man Hours */}
                <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700">
                    <label className="text-xs text-slate-500 font-bold uppercase mb-3 block flex items-center gap-2">
                        <Clock size={14} />
                        Production Estimation
                    </label>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-[10px] text-slate-400 block mb-1">Base Man-Hours (h)</label>
                            <input
                                type="number"
                                className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-sm focus:border-emerald-500 outline-none text-right"
                                value={door.manHours || 0}
                                onChange={e => onChange({ manHours: Number(e.target.value) })}
                                min={0}
                                step={0.5}
                            />
                        </div>
                        <div>
                            <label className="text-[10px] text-slate-400 block mb-1">Complexity (x)</label>
                            <input
                                type="number"
                                className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-sm focus:border-emerald-500 outline-none text-right"
                                value={door.complexity || 1.0}
                                onChange={e => onChange({ complexity: Number(e.target.value) })}
                                min={0.5}
                                max={5.0}
                                step={0.1}
                            />
                        </div>
                    </div>

                    <div className="mt-3 pt-3 border-t border-slate-700 flex justify-between items-center text-sm">
                        <span className="text-slate-500">Total Est.</span>
                        <span className="font-bold text-amber-400">
                            {((door.manHours || 0) * (door.complexity || 1)).toFixed(1)} h
                        </span>
                    </div>
                </div>

                {/* Dates */}
                <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700">
                    <label className="text-xs text-slate-500 font-bold uppercase mb-3 block flex items-center gap-2">
                        <BarChart size={14} />
                        Timeline
                    </label>

                    <div className="space-y-3">
                        <div>
                            <label className="text-[10px] text-slate-400 block mb-1">Start Date</label>
                            <input
                                type="date"
                                className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-sm focus:border-emerald-500 outline-none"
                                value={formatDate(door.startDate)}
                                onChange={e => onChange({ startDate: parseDate(e.target.value) })}
                            />
                        </div>
                        <div>
                            <label className="text-[10px] text-slate-400 block mb-1">Due Date</label>
                            <input
                                type="date"
                                className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-sm focus:border-emerald-500 outline-none"
                                value={formatDate(door.dueDate)}
                                onChange={e => onChange({ dueDate: parseDate(e.target.value) })}
                            />
                        </div>
                    </div>
                </div>

                {/* Status */}
                <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700">
                    <label className="text-xs text-slate-500 font-bold uppercase mb-3 block">Current Status</label>
                    <select
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-sm focus:border-emerald-500 outline-none"
                        value={door.status || 'design'}
                        onChange={e => onChange({ status: e.target.value as any })}
                    >
                        <option value="design">Design / Est</option>
                        <option value="production">Production</option>
                        <option value="completed">Completed</option>
                    </select>
                </div>
            </div>
        </div>
    );
};
