import React, { useState } from 'react';
import { WeeklyPattern } from '../../types';
import { Check, RefreshCw } from 'lucide-react';

interface WeeklyPatternEditorProps {
    initialPattern?: WeeklyPattern;
    onSave: (pattern: WeeklyPattern) => void;
    onCancel: () => void;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const WeeklyPatternEditor: React.FC<WeeklyPatternEditorProps> = ({
    initialPattern,
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

    // Apply change to a specific day
    const handleChange = (dayIndex: number, minutes: number) => {
        setPattern(prev => ({
            ...prev,
            [dayIndex]: Math.max(0, Math.min(1440, minutes))
        }));
    };

    const handleSave = () => {
        onSave(pattern);
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

                    return (
                        <div key={dayName} className="flex items-center gap-4">
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
                                        className="w-full p-1 border rounded text-right pr-6"
                                    />
                                    <span className="absolute right-1 top-1 text-xs text-gray-400">m</span>
                                </div>
                            </div>

                            {/* Hours Display */}
                            <div className="w-12 text-sm text-gray-500 text-right">
                                {hours}h
                            </div>
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
