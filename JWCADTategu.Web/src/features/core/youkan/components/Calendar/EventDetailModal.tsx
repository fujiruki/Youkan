import React, { useEffect } from 'react';
import { X, ExternalLink, MapPin, Clock } from 'lucide-react';
import { ExternalEvent } from '../../types/externalEvent';

interface Props {
    isOpen: boolean;
    event: ExternalEvent | null;
    onClose: () => void;
}

const pad2 = (n: number) => String(n).padStart(2, '0');

const formatDateTimeLine = (event: ExternalEvent): string => {
    const start = new Date(event.startAt * 1000);
    const end = new Date(event.endAt * 1000);

    const ymd = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
    const hm = (d: Date) => `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;

    if (event.allDay) {
        const startKey = ymd(start);
        // end は exclusive を想定。endMs - 1 日のキーを比較
        const endAdj = new Date(end.getTime() - 1);
        const endKey = ymd(endAdj);
        if (startKey === endKey) return `${startKey}（終日）`;
        return `${startKey} 〜 ${endKey}（終日）`;
    }

    const sameDay = ymd(start) === ymd(end);
    if (sameDay) return `${ymd(start)} ${hm(start)} 〜 ${hm(end)}`;
    return `${ymd(start)} ${hm(start)} 〜 ${ymd(end)} ${hm(end)}`;
};

const GOOGLE_CALENDAR_HOME = 'https://calendar.google.com/calendar/u/0/r';

/**
 * R-034 Phase 2: Google カレンダーイベント詳細モーダル。
 *
 * - 編集 / 削除など操作系は持たない（Youkan からは読み取り専用）
 * - 閉じる: ✕ボタン / 背景タップ / Esc
 * - DecisionDetailModal とは別物（タスクではないため）
 */
export const EventDetailModal: React.FC<Props> = ({ isOpen, event, onClose }) => {
    useEffect(() => {
        if (!isOpen) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [isOpen, onClose]);

    if (!isOpen || !event) return null;

    const title = (event.title && event.title.trim()) || '(無題)';
    const dateLine = formatDateTimeLine(event);
    const openUrl = event.htmlLink || GOOGLE_CALENDAR_HOME;

    return (
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-150"
            role="dialog"
            aria-modal="true"
            aria-label="イベント詳細"
        >
            <div
                data-testid="event-detail-overlay"
                className="absolute inset-0"
                onClick={onClose}
                aria-hidden="true"
            />
            <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 dark:border-slate-800 flex flex-col">
                <div className="flex items-start justify-between p-5 border-b border-slate-100 dark:border-slate-800 gap-3">
                    <div className="flex-1 min-w-0">
                        <div className="text-[10px] font-black text-indigo-500 dark:text-indigo-400 uppercase tracking-widest mb-1">
                            📅 Google カレンダー
                        </div>
                        <h3 className="text-lg font-black text-slate-800 dark:text-slate-100 break-words leading-snug">
                            {title}
                        </h3>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 shrink-0"
                        aria-label="閉じる"
                    >
                        <X size={18} />
                    </button>
                </div>

                <div className="p-5 space-y-3">
                    <div className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-200">
                        <Clock size={16} className="mt-0.5 text-slate-400 shrink-0" />
                        <span className="font-mono tabular-nums">{dateLine}</span>
                    </div>
                    {event.location && (
                        <div className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-200">
                            <MapPin size={16} className="mt-0.5 text-slate-400 shrink-0" />
                            <span className="break-words">{event.location}</span>
                        </div>
                    )}
                </div>

                <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40">
                    <a
                        href={openUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-sm font-bold text-indigo-700 dark:text-indigo-300 hover:underline"
                    >
                        <ExternalLink size={14} />
                        Google カレンダーで開く
                    </a>
                </div>
            </div>
        </div>
    );
};
