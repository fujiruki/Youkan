import type { GoogleCalendar } from '../../../../api/googleCalendar';

/**
 * R-041-Y3: Google カレンダーイベントチップの色解決ユーティリティ。
 *
 * - `getCalendarColor` は ExternalEvent の `calendarId` から該当カレンダーの `colorHex` を返す
 * - `toTint` は hex カラーをチップ背景用に薄い rgba（既定 10% 不透明度）に変換する
 */
export const getCalendarColor = (
    calendarId: string | undefined,
    calendars: GoogleCalendar[],
): string | undefined => calendars.find(c => c.calendarId === calendarId)?.colorHex;

/** カラー hex を不透明度付き rgba 文字列に変換する（既定 alpha=0.1） */
export const toTint = (hex: string | undefined, alpha = 0.1): string | undefined => {
    if (!hex) return undefined;
    const m = hex.replace('#', '');
    const r = parseInt(m.slice(0, 2), 16);
    const g = parseInt(m.slice(2, 4), 16);
    const b = parseInt(m.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};
