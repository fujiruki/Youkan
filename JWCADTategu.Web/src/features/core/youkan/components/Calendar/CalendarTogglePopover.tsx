import React, { useEffect, useRef } from 'react';
import type { GoogleCalendar } from '../../../../../api/googleCalendar';

interface Props {
    calendars: GoogleCalendar[];
    onToggle: (id: number, isEnabled: boolean) => Promise<void>;
    onClose: () => void;
    /** ボトムシート埋め込み用：外側クリック検知をスキップする */
    embedded?: boolean;
}

/**
 * R-041-Y2: PC 用ポップオーバー。
 * - 「表示するカレンダー」ヘッダー＋全選択/全解除リンク
 * - チェックボックス＋色チップ＋カレンダー名の縦並びリスト
 * - 最大 320px までスクロール可
 * - 外側クリックで閉じる（embedded=true のときは親が制御）
 */
export const CalendarTogglePopover: React.FC<Props> = ({
    calendars,
    onToggle,
    onClose,
    embedded = false,
}) => {
    const rootRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (embedded) return;
        const handler = (e: MouseEvent) => {
            if (!rootRef.current) return;
            if (e.target instanceof Node && !rootRef.current.contains(e.target)) {
                onClose();
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [onClose, embedded]);

    const handleSelectAll = () => {
        for (const c of calendars) {
            if (!c.isEnabled) {
                void onToggle(c.id, true);
            }
        }
    };

    const handleDeselectAll = () => {
        for (const c of calendars) {
            if (c.isEnabled) {
                void onToggle(c.id, false);
            }
        }
    };

    return (
        <div
            ref={rootRef}
            className={
                embedded
                    ? 'w-full bg-white dark:bg-slate-900'
                    : 'absolute right-0 top-full mt-2 w-[280px] bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 z-50'
            }
            role="dialog"
            aria-label="表示するカレンダー"
        >
            <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100 dark:border-slate-800">
                <h3 className="text-xs font-black text-slate-700 dark:text-slate-200 tracking-tight">
                    表示するカレンダー
                </h3>
                <div className="flex items-center gap-2 text-[10px] font-bold">
                    <button
                        type="button"
                        onClick={handleSelectAll}
                        className="text-indigo-600 dark:text-indigo-400 hover:underline disabled:text-slate-300 disabled:no-underline"
                        disabled={calendars.length === 0}
                    >
                        全選択
                    </button>
                    <span className="text-slate-300 dark:text-slate-700">|</span>
                    <button
                        type="button"
                        onClick={handleDeselectAll}
                        className="text-slate-500 dark:text-slate-400 hover:underline disabled:text-slate-300 disabled:no-underline"
                        disabled={calendars.length === 0}
                    >
                        全解除
                    </button>
                </div>
            </div>

            {calendars.length === 0 ? (
                <div className="px-3 py-6 text-center text-[11px] text-slate-500 dark:text-slate-400">
                    カレンダーが見つかりません
                </div>
            ) : (
                <ul className="max-h-[320px] overflow-y-auto py-1">
                    {calendars.map(cal => (
                        <li key={cal.id}>
                            <label className="flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/60">
                                <input
                                    type="checkbox"
                                    checked={cal.isEnabled}
                                    onChange={(e) => {
                                        void onToggle(cal.id, e.target.checked);
                                    }}
                                    className="w-3.5 h-3.5 accent-indigo-600 cursor-pointer"
                                />
                                <span
                                    aria-hidden="true"
                                    className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                                    style={{ backgroundColor: cal.colorHex || '#9ca3af' }}
                                />
                                <span className="text-[12px] text-slate-700 dark:text-slate-200 truncate" title={cal.summary}>
                                    {cal.summary}
                                </span>
                            </label>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};
