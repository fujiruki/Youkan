
import React from 'react';
import { CapacityConfig, HolidayRule, WeekDay } from '../types';
import { motion } from 'framer-motion';

interface HolidayConfigProps {
    config: CapacityConfig;
    onUpdate: (newConfig: CapacityConfig) => void;
}

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

export const HolidayConfigPanel: React.FC<HolidayConfigProps> = ({ config, onUpdate }) => {
    const [localConfig, setLocalConfig] = React.useState<CapacityConfig>(config);

    React.useEffect(() => {
        setLocalConfig(config);
    }, [config]);

    const handleWeeklyToggle = (dayIndex: WeekDay) => {
        const isHoliday = localConfig.holidays.some(h => h.type === 'weekly' && h.value === dayIndex.toString());
        let newHolidays = [...localConfig.holidays];

        if (isHoliday) {
            newHolidays = newHolidays.filter(h => !(h.type === 'weekly' && h.value === dayIndex.toString()));
        } else {
            newHolidays.push({ type: 'weekly', value: dayIndex.toString(), label: '定休日' });
        }

        const newConfig = { ...localConfig, holidays: newHolidays };
        setLocalConfig(newConfig);
        onUpdate(newConfig);
    };

    return (
        <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 space-y-6">
            <div>
                <h3 className="text-sm font-bold text-slate-500 mb-2">標準稼働時間</h3>
                <div className="flex items-center gap-2">
                    <input
                        type="number"
                        value={localConfig.defaultDailyMinutes / 60}
                        onChange={(e) => {
                            const hours = parseFloat(e.target.value);
                            const newConfig = { ...localConfig, defaultDailyMinutes: hours * 60 };
                            setLocalConfig(newConfig);
                            onUpdate(newConfig);
                        }}
                        className="w-20 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-right font-mono font-bold"
                    />
                    <span className="text-sm text-slate-600">時間 / 日</span>
                </div>
            </div>

            <div>
                <h3 className="text-sm font-bold text-slate-500 mb-2">定休日設定</h3>
                <div className="flex gap-2">
                    {WEEKDAYS.map((day, index) => {
                        const isHoliday = localConfig.holidays.some(h => h.type === 'weekly' && h.value === index.toString());
                        return (
                            <button
                                key={day}
                                onClick={() => handleWeeklyToggle(index as WeekDay)}
                                className={`
                                    w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all
                                    ${isHoliday
                                        ? 'bg-red-100 text-red-600 border-2 border-red-200'
                                        : 'bg-slate-50 text-slate-400 border border-slate-200 hover:border-slate-300'
                                    }
                                `}
                            >
                                {day}
                            </button>
                        );
                    })}
                </div>
            </div>

            <div>
                <h3 className="text-sm font-bold text-slate-500 mb-2">例外・祝日</h3>
                <p className="text-xs text-slate-400">
                    ※ カレンダーから指定日をクリックして「休業」または「稼働調整」を設定できます（現在開発中）
                </p>
            </div>
        </div>
    );
};
