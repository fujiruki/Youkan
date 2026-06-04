import React, { useState } from 'react';
import { Calendar } from 'lucide-react';
import { cn } from '../../../../../lib/utils';
import { useGoogleCalendars } from '../../hooks/useGoogleCalendars';
import { useIsMobile } from '../../../../../hooks/useMediaQuery';
import { CalendarTogglePopover } from './CalendarTogglePopover';
import { CalendarToggleSheet } from './CalendarToggleSheet';

/**
 * R-041-Y2: 「表示するカレンダー」切替ボタン。
 * - 表示: 📅 N/M（N = 有効カレンダー数 / M = 全カレンダー数）
 * - PC: クリックでポップオーバー（自前実装、外側クリックで閉じる）
 * - スマホ: クリックで MobileBottomSheet（R-033 既存）
 * - カレンダー画面（grid/gantt/timeline）のヘッダー右側に配置する
 */
export const CalendarToggleButton: React.FC = () => {
    const { calendars, loading, toggle } = useGoogleCalendars();
    const [isOpen, setIsOpen] = useState(false);
    const isMobile = useIsMobile();

    const enabledCount = calendars.filter(c => c.isEnabled).length;
    const total = calendars.length;

    return (
        <div className="relative inline-block">
            <button
                type="button"
                onClick={() => setIsOpen(o => !o)}
                aria-label="表示するカレンダー"
                aria-haspopup="dialog"
                aria-expanded={isOpen}
                disabled={loading}
                className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-black rounded-xl border transition-all duration-300',
                    isOpen
                        ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800/50'
                        : 'bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-indigo-200',
                    loading && 'opacity-50 cursor-wait',
                )}
                title="表示するカレンダーを切り替え"
            >
                <Calendar size={14} strokeWidth={2.5} />
                <span className="font-mono tabular-nums">{enabledCount}/{total}</span>
            </button>

            {isOpen && !isMobile && (
                <CalendarTogglePopover
                    calendars={calendars}
                    onToggle={toggle}
                    onClose={() => setIsOpen(false)}
                />
            )}
            {isMobile && (
                <CalendarToggleSheet
                    isOpen={isOpen}
                    onClose={() => setIsOpen(false)}
                    calendars={calendars}
                    onToggle={toggle}
                />
            )}
        </div>
    );
};
