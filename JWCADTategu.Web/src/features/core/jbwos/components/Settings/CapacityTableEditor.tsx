import React, { useState } from 'react';
import { WeeklyPattern, WeeklyCompanyPattern } from '../../types';

/**
 * CapacityTableEditor - 表形式で曜日×会社別の稼働時間を入力するUI
 * 
 * 各行 = 曜日（日〜土）
 * 各列 = 会社 + 合計 + フリー
 * セルに分数を直接入力する
 */

interface TenantInfo {
    id: string;
    name: string;
}

interface CapacityTableEditorProps {
    standardWeeklyPattern: WeeklyPattern;
    companyWeeklyPattern?: WeeklyCompanyPattern;
    tenants: TenantInfo[];
    onChange: (standard: WeeklyPattern, company: WeeklyCompanyPattern) => void;
}

const DAY_LABELS = ['日', '月', '火', '水', '木', '金', '土'];

export const CapacityTableEditor: React.FC<CapacityTableEditorProps> = ({
    standardWeeklyPattern,
    companyWeeklyPattern,
    tenants,
    onChange
}) => {
    const [pattern, setPattern] = useState<WeeklyPattern>({ ...standardWeeklyPattern });
    const [companyPattern, setCompanyPattern] = useState<WeeklyCompanyPattern>(companyWeeklyPattern || {});

    // 総稼働時間の変更
    const handleTotalChange = (dayIndex: number, value: string) => {
        const minutes = Math.max(0, Math.min(1440, parseInt(value) || 0));
        const newPattern = { ...pattern, [dayIndex]: minutes };
        setPattern(newPattern);
        onChange(newPattern, companyPattern);
    };

    // 会社別時間の変更
    const handleCompanyChange = (dayIndex: number, tenantId: string, value: string) => {
        const minutes = Math.max(0, parseInt(value) || 0);
        const dayAllocation = { ...(companyPattern[dayIndex] || {}) };
        dayAllocation[tenantId] = minutes;
        const newCompanyPattern = { ...companyPattern, [dayIndex]: dayAllocation };
        setCompanyPattern(newCompanyPattern);
        onChange(pattern, newCompanyPattern);
    };

    // 会社割当合計
    const getAssignedTotal = (dayIndex: number): number => {
        const alloc = companyPattern[dayIndex] || {};
        return Object.values(alloc).reduce((sum, v) => sum + (v || 0), 0);
    };

    // フリー時間（合計 - 割当合計）
    const getFreeTime = (dayIndex: number): number => {
        return (pattern[dayIndex] || 0) - getAssignedTotal(dayIndex);
    };

    // 週合計
    const weekTotal = Object.values(pattern).reduce((sum, v) => sum + (v || 0), 0);

    const isWeekend = (i: number) => i === 0 || i === 6;

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
                <thead>
                    <tr className="bg-slate-50 dark:bg-slate-900/50">
                        <th className="px-3 py-2 text-left font-medium text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700 w-16">
                            曜日
                        </th>
                        <th className="px-3 py-2 text-center font-medium text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700 w-24">
                            合計(分)
                        </th>
                        {tenants.map(t => (
                            <th key={t.id} className="px-3 py-2 text-center font-medium text-indigo-600 dark:text-indigo-400 border-b border-slate-200 dark:border-slate-700 w-24">
                                {t.name.length > 6 ? t.name.substring(0, 6) + '…' : t.name}
                            </th>
                        ))}
                        <th className="px-3 py-2 text-center font-medium text-slate-400 dark:text-slate-500 border-b border-slate-200 dark:border-slate-700 w-20">
                            フリー
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {DAY_LABELS.map((label, dayIndex) => {
                        const total = pattern[dayIndex] || 0;
                        const freeTime = getFreeTime(dayIndex);
                        const isOver = freeTime < 0;

                        return (
                            <tr key={dayIndex}
                                className={`${isWeekend(dayIndex) ? 'bg-red-50/40 dark:bg-red-900/10' : ''} hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors`}
                            >
                                <td className={`px-3 py-2 font-bold border-b border-slate-100 dark:border-slate-800 ${isWeekend(dayIndex) ? 'text-red-500' : 'text-slate-700 dark:text-slate-300'}`}>
                                    {label}
                                </td>
                                <td className="px-1 py-1.5 border-b border-slate-100 dark:border-slate-800">
                                    <input
                                        type="number"
                                        min={0}
                                        max={1440}
                                        value={total}
                                        onChange={(e) => handleTotalChange(dayIndex, e.target.value)}
                                        className="w-full px-2 py-1.5 text-center rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-sm font-mono"
                                    />
                                </td>
                                {tenants.map(t => {
                                    const val = (companyPattern[dayIndex] || {})[t.id] || 0;
                                    return (
                                        <td key={t.id} className="px-1 py-1.5 border-b border-slate-100 dark:border-slate-800">
                                            <input
                                                type="number"
                                                min={0}
                                                value={val}
                                                onChange={(e) => handleCompanyChange(dayIndex, t.id, e.target.value)}
                                                className="w-full px-2 py-1.5 text-center rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-indigo-400 focus:border-transparent outline-none text-sm font-mono"
                                            />
                                        </td>
                                    );
                                })}
                                <td className={`px-3 py-2 text-center font-mono text-sm border-b border-slate-100 dark:border-slate-800 ${isOver ? 'text-red-500 font-bold' : 'text-slate-400'}`}>
                                    {freeTime}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
                <tfoot>
                    <tr className="bg-slate-50 dark:bg-slate-900/50 font-medium">
                        <td className="px-3 py-2 text-slate-600 dark:text-slate-300 border-t border-slate-200 dark:border-slate-700">
                            週計
                        </td>
                        <td className="px-3 py-2 text-center text-slate-700 dark:text-slate-200 font-mono border-t border-slate-200 dark:border-slate-700">
                            {weekTotal}
                            <span className="ml-1 text-xs text-slate-400 font-normal">({(weekTotal / 60).toFixed(1)}h)</span>
                        </td>
                        {tenants.map(t => {
                            const tenantTotal = DAY_LABELS.reduce((sum, _, i) => sum + ((companyPattern[i] || {})[t.id] || 0), 0);
                            return (
                                <td key={t.id} className="px-3 py-2 text-center text-indigo-600 dark:text-indigo-400 font-mono border-t border-slate-200 dark:border-slate-700">
                                    {tenantTotal}
                                    <span className="ml-1 text-xs text-slate-400 font-normal">({(tenantTotal / 60).toFixed(1)}h)</span>
                                </td>
                            );
                        })}
                        <td className="px-3 py-2 text-center text-slate-400 font-mono border-t border-slate-200 dark:border-slate-700">
                            {DAY_LABELS.reduce((sum, _, i) => sum + getFreeTime(i), 0)}
                        </td>
                    </tr>
                </tfoot>
            </table>
            <p className="mt-2 text-xs text-slate-400">
                ※ 各セルに分数を入力。「フリー」は合計から会社の割当を引いた残り時間です。
            </p>
        </div>
    );
};
