import React, { useState } from 'react';
import { WeeklyPattern, WeeklyCompanyPattern, JoinedTenant, CompanyAllocation } from '../../types';
import { Check, RefreshCw, ChevronDown, ChevronRight } from 'lucide-react';
import { CompanyAllocationEditor } from './CompanyAllocationEditor';

interface WeeklyPatternEditorProps {
    initialPattern?: WeeklyPattern;
    initialCompanyPattern?: WeeklyCompanyPattern; // [NEW]
    joinedTenants?: JoinedTenant[]; // [NEW]
    onSave: (pattern: WeeklyPattern, companyPattern: WeeklyCompanyPattern) => void;
    onCancel: () => void;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const WeeklyPatternEditor: React.FC<WeeklyPatternEditorProps> = ({
    initialPattern,
    initialCompanyPattern,
    joinedTenants,
    onSave,
    onCancel
}) => {
    // Default: Mon-Fri 8h, Sat-Sun 0h
    const defaultPattern: WeeklyPattern = {
        0: 0,
        1: 480,
        2: 480,
        3: 480,
        4: 480,
        5: 480,
        6: 0
    };

    const [pattern, setPattern] = useState<WeeklyPattern>(initialPattern || defaultPattern);
    const [companyPattern, setCompanyPattern] = useState<WeeklyCompanyPattern>(initialCompanyPattern || {});
    const [expandedDay, setExpandedDay] = useState<number | null>(null);

    // Apply change to a specific day
    const handleChange = (dayIndex: number, minutes: number) => {
        setPattern(prev => ({
            ...prev,
            [dayIndex]: Math.max(0, Math.min(1440, minutes))
        }));
    };

    const handleCompanyAllocationChange = (dayIndex: number, allocation: CompanyAllocation) => {
        setCompanyPattern(prev => ({
            ...prev,
            [dayIndex]: allocation
        }));
    };

    const handleSave = () => {
        onSave(pattern, companyPattern);
    };

    // Calculate total hours
    const totalWeeklyMinutes = Object.values(pattern).reduce((sum, val) => sum + (val || 0), 0);
    const totalWeeklyHours = (totalWeeklyMinutes / 60).toFixed(1);

    return (
        <div className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow-md border dark:border-gray-700">
            <h3 className="text-lg font-bold mb-4 flex items-center justify-between">
                <span>週間稼働パターン設定</span>
                <span className="text-sm font-normal text-gray-500">週合計: {totalWeeklyHours}時間</span>
            </h3>

            <div className="space-y-4">
                {DAYS.map((dayName, index) => {
                    const minutes = pattern[index] || 0;
                    const hours = (minutes / 60).toFixed(1);
                    const isWeekend = index === 0 || index === 6;
                    const isExpanded = expandedDay === index;
                    const dayAllocation = companyPattern[index] || {};

                    return (
                        <div key={dayName} className="border-b dark:border-gray-700 pb-4 last:border-0">
                            <div className="flex items-center gap-4">
                                <button
                                    onClick={() => setExpandedDay(isExpanded ? null : index)}
                                    className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors text-gray-400"
                                >
                                    {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                </button>
                                <div className={`w-12 font-bold ${isWeekend ? 'text-red-500' : 'text-gray-700 dark:text-gray-300'}`}>
                                    {dayName}
                                </div>

                                {/* Slider (Rough adjustment: 0-12h) */}
                                <div className="flex-1">
                                    <input
                                        type="range"
                                        min={0}
                                        max={720} // 12h max on slider for precision
                                        step={30}
                                        value={minutes > 720 ? 720 : minutes}
                                        onChange={(e) => handleChange(index, parseInt(e.target.value))}
                                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                                    />
                                </div>

                                {/* Number Input (Precise adjustment) */}
                                <div className="w-20">
                                    <div className="relative">
                                        <input
                                            type="number"
                                            min={0}
                                            max={1440}
                                            value={minutes}
                                            onChange={(e) => handleChange(index, parseInt(e.target.value) || 0)}
                                            className="w-full p-1 border rounded text-right pr-6 dark:bg-gray-800 dark:border-gray-600"
                                        />
                                        <span className="absolute right-1 top-1 text-xs text-gray-400">m</span>
                                    </div>
                                </div>

                                {/* Hours Display */}
                                <div className="w-12 text-sm text-gray-500 text-right">
                                    {hours}h
                                </div>
                            </div>

                            {/* [NEW] Expanded Company Allocation Section */}
                            {isExpanded && joinedTenants && joinedTenants.length > 0 && (
                                <div className="mt-4 ml-8 animate-in slide-in-from-top-2 duration-200">
                                    <CompanyAllocationEditor
                                        tenants={joinedTenants}
                                        allocation={dayAllocation}
                                        totalAvailableMinutes={minutes}
                                        onChange={(newAlloc) => handleCompanyAllocationChange(index, newAlloc)}
                                    />
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            <div className="mt-6 flex justify-end gap-2">
                <button
                    onClick={() => setPattern(defaultPattern)}
                    className="mr-auto p-2 border border-gray-300 rounded hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-700"
                    title="リセット"
                >
                    <RefreshCw className="w-4 h-4" />
                </button>
                <div onClick={onCancel} className="cursor-pointer px-4 py-2 text-gray-500 hover:text-gray-700 flex items-center">
                    キャンセル
                </div>
                <button
                    onClick={handleSave}
                    className="flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded shadow-sm"
                >
                    <Check className="w-4 h-4 mr-2" /> 保存
                </button>
            </div>
        </div>
    );
};
