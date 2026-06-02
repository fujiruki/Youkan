import React from 'react';
import { cn } from '../../../../../lib/utils';
import { ExternalEvent } from '../../types/externalEvent';

interface Props {
    event: ExternalEvent;
    onClick?: (event: ExternalEvent) => void;
    /** 量感計算と並ぶ表示なので、テキストサイズ等を呼出側で抑制したい場合用 */
    compact?: boolean;
}

const pad2 = (n: number) => String(n).padStart(2, '0');

const formatTimeLabel = (event: ExternalEvent): string => {
    if (event.allDay) return '[終日]';
    const d = new Date(event.startAt * 1000);
    return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
};

/**
 * R-034 Phase 2: グリッドビューのセル内に表示する Google カレンダーイベントチップ。
 *
 * - 単色テーマ（indigo 系）でタスクと差別化
 * - Google イベントは Youkan のタスクではないため、完了スタイル（R-035）は適用しない
 */
export const ExternalEventChip: React.FC<Props> = React.memo(({ event, onClick, compact = false }) => {
    const timeLabel = formatTimeLabel(event);
    const title = (event.title && event.title.trim()) || '(無題)';

    const handleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (onClick) onClick(event);
    };

    return (
        <button
            type="button"
            onClick={handleClick}
            title={`${timeLabel} ${title}`}
            className={cn(
                'w-full flex items-center gap-0.5 text-left truncate rounded-[2px] border-l-2 cursor-pointer pointer-events-auto transition-colors mb-0.5 px-1 py-px',
                'bg-indigo-50 dark:bg-indigo-900/40',
                'border-l-indigo-400 dark:border-l-indigo-500',
                'text-indigo-700 dark:text-indigo-200',
                'hover:bg-indigo-100 dark:hover:bg-indigo-900/60',
                compact ? 'text-[9px]' : 'text-[10px]'
            )}
        >
            <span aria-hidden="true">📅</span>
            <span className="font-semibold tabular-nums">{timeLabel}</span>
            <span className="truncate">{title}</span>
        </button>
    );
});

ExternalEventChip.displayName = 'ExternalEventChip';
