import { Item, FilterMode } from '../types';
import { isHoliday } from './capacity';

// Default config matched with RyokanCalendar
export const DEFAULT_CAPACITY_CONFIG: any = {
    holidays: [
        { type: 'weekly', value: '0' }, // Sunday
        { type: 'weekly', value: '6' }  // Saturday
    ],
    defaultDailyMinutes: 480, // 8 hours (Standard Work Capacity)
    exceptions: {}
};

// Helper: Parse Date String YYYY-MM-DD
const parseDateString = (dateStr: string | undefined | null): Date | null => {
    if (!dateStr) return null;
    return new Date(dateStr);
};

/**
 * Calculates daily volume (load minutes) map based on items and filtering context.
 * 
 * [Ryokan (Volume) Logic]
 * Allocated backwards from prep_date based on estimatedMinutes or workDays.
 */
export const calculateDailyVolume = (
    items: Item[],
    capacityConfig: any = DEFAULT_CAPACITY_CONFIG,
    filterMode: FilterMode = 'all'
): Map<string, number> => {
    const map = new Map<string, number>();
    const dailyLimit = capacityConfig.defaultDailyMinutes || 480;

    // Filter items based on context before calculation
    const filteredItems = items.filter(item => {
        if (filterMode === 'company') return !!item.tenantId || !!item.projectId;
        if (filterMode === 'personal') return !item.tenantId && !item.projectId;
        return true; // 'all'
    });

    filteredItems.forEach(item => {
        // 対象: prep_dateがあり、未完了のもの
        // （完了済みタスクも含めるべきかは議論があるが、負荷予測なら未完了メイン。
        //   ただし、過去日の実績を見るなら完了済みも必要。今回は「未来の負荷」重視で、一旦全タスク対象とする）

        if (item.prep_date) {
            const prepDate = new Date(item.prep_date * 1000);

            // 必要な総時間 (分)
            // estimatedMinutesがない場合は work_days * 8h (480m) で概算
            let remainingMinutes = item.estimatedMinutes || (item.work_days ? item.work_days * 480 : 60);

            // 安全装置: 無限ループ防止 & 異常に長いタスクの切り捨て
            let safety = 0;
            let current = new Date(prepDate);

            // 期限日当日も含めて割り振る
            while (remainingMinutes > 0 && safety < 60) { // 最大60日前まで
                safety++;

                // 休日判定 (休日は割り振らない = スキップ)
                // ただし設定で「休日稼働OK」なら割り振るロジックも将来的にはありうる
                if (isHoliday(current, capacityConfig)) {
                    // 何もしないで前日へ
                    current.setDate(current.getDate() - 1);
                    continue;
                }

                // その日の割り当て量 = min(残り, 1日の限界)
                // ここでの dailyLimit は「このタスクに割ける1日の最大」という意味合い。
                // 実際には 8時間/日 が妥当。
                const alloc = Math.min(remainingMinutes, dailyLimit);

                const key = current.toDateString();
                const currentTotal = map.get(key) || 0;
                map.set(key, currentTotal + alloc);

                remainingMinutes -= alloc;

                // 前日へ移動
                current.setDate(current.getDate() - 1);
            }
        } else if (item.due_date) {
            // prep_dateはないがdue_dateはある場合 -> 締切日に少し負荷を乗せる（注意喚起）
            const d = parseDateString(item.due_date);
            if (d) {
                const key = d.toDateString();
                // 便宜上 60分程度の負荷として可視化
                map.set(key, (map.get(key) || 0) + 60);
            }
        }
    });

    return map;
};

/**
 * Returns the Tailwind CSS class for the background color based on volume percentage.
 * 
 * Volume is now in MINUTES.
 * Capacity is assumed to be 480min (8h) by default, or passed via argument?
 * Currently we simulate percentage based on standard 8h (480m).
 * 
 * < 60% (288m): Chill (Green/Blue)
 * 60-90% (288-432m): Moderate (Yellow/Orange)
 * 90-110% (432-528m): Busy (Red)
 * > 110% (528m+): Overload (Purple)
 */
export const getVolumeColorClass = (minutes: number): string => {
    if (!minutes || minutes <= 0) return "";

    const capacity = 480; // Standard 8h
    const ratio = minutes / capacity;

    if (ratio < 0.6) return "bg-emerald-500/[0.20] dark:bg-emerald-400/[0.15]";      // Chill
    if (ratio < 0.9) return "bg-amber-500/[0.40] dark:bg-amber-400/[0.30]";      // Moderate
    if (ratio < 1.1) return "bg-red-500/[0.50] dark:bg-red-400/[0.40]";          // Busy
    return "bg-purple-600/[0.60] dark:bg-purple-500/[0.50]";                     // Overload
};
