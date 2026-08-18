import { Item, CapacityConfig } from '../types';
import { parseISO, startOfDay, endOfWeek, eachDayOfInterval, format } from 'date-fns';
import { getDailyCapacity } from './capacity';
import { getEffectiveDeadline } from './flowAutoPlace';

const EXCLUDED_STATUSES = new Set(['done', 'cancelled', 'someday']);

export interface WeekLoadCandidate {
    id: string;
    title: string;
    deadline: string; // "YYYY-MM-DD"
    estimatedMinutes: number;
}

export interface WeekLoad {
    capacityMinutes: number;
    needMinutes: number;
    shortfallMinutes: number;
    weekEnd: string; // "YYYY-MM-DD"（今週の日曜）
    overCandidates: WeekLoadCandidate[];
}

const isWeekLoadTarget = (item: Item): boolean => {
    if (item.deletedAt) return false;
    if (item.isArchived) return false;
    if (item.isProject) return false;
    return !EXCLUDED_STATUSES.has(item.status);
};

/**
 * R-128: 今週の残量（F-27）。今日〜今週の日曜（月曜始まり）を対象に、
 * 日次キャパの単純合計と、有効締切がその範囲以前（期限超過分も含む）の
 * 未完了アイテムの目安時間の単純合計を比較する。逆算配分・安全係数は使わない
 * （両方とも既存の別関数の役割であり、ここに混ぜない）。
 *
 * `backend/QuantityService.php` の `calcWeekLoad` と同じ式・同じキー名（snake_case対応）で
 * 実装する。片方だけを直さない。
 */
export function calcWeekLoad(
    items: Item[],
    capacityConfig: CapacityConfig | null | undefined,
    today: string,
    excludeItemId?: string
): WeekLoad {
    // capacityConfig未ロード時（初期マウント直後・テストダブル）は0扱いにする。フェイルセーフ
    const safeCapacityConfig: CapacityConfig = capacityConfig ?? { defaultDailyMinutes: 0, holidays: [], exceptions: {} };

    const todayDate = startOfDay(parseISO(today));
    const weekEndDate = endOfWeek(todayDate, { weekStartsOn: 1 });
    const weekEndTime = weekEndDate.getTime();

    const capacityMinutes = eachDayOfInterval({ start: todayDate, end: weekEndDate })
        .reduce((sum, date) => sum + getDailyCapacity(date, safeCapacityConfig), 0);

    const targets = items
        .filter(isWeekLoadTarget)
        .map(item => ({ item, deadline: getEffectiveDeadline(item) }))
        .filter((t): t is { item: Item; deadline: number } => t.deadline !== null && t.deadline <= weekEndTime);

    const needMinutes = targets.reduce((sum, t) => sum + (t.item.estimatedMinutes ?? 0), 0);
    const shortfallMinutes = Math.max(0, needMinutes - capacityMinutes);

    const overCandidates: WeekLoadCandidate[] = targets
        .filter(t => t.item.id !== excludeItemId)
        .sort((a, b) => b.deadline - a.deadline)
        .slice(0, 2)
        .map(t => ({
            id: t.item.id,
            title: t.item.title,
            deadline: format(t.deadline, 'yyyy-MM-dd'),
            estimatedMinutes: t.item.estimatedMinutes ?? 0
        }));

    return {
        capacityMinutes,
        needMinutes,
        shortfallMinutes,
        weekEnd: format(weekEndDate, 'yyyy-MM-dd'),
        overCandidates
    };
}

/**
 * R-128: 分を「Xh」（小数1桁まで）に整形する。ヘッダー1行・Toastの両方が使う。
 * 既存 `formatMinutes`（logic/timeParser.ts）は60分未満で「Xm」表記になり、
 * §16「今週 必要Yh／枠Xh」の常にh単位という前提と合わないため専用に用意する。
 */
export function formatWeekLoadHours(minutes: number): string {
    const rounded = Math.round(minutes / 6) / 10;
    return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)}h`;
}

/**
 * R-128: 登録時の一言（画面）。§16「今週 Zh足りない。外す候補: A(8/22, 3h)／B(8/23, 4h)」。
 * 候補が0件のときは「外す候補」部分を省く。判断UI・確認ダイアログは付けない（呼び出し側の責務）。
 */
export function formatWeekLoadToastMessage(weekLoad: WeekLoad): string {
    const base = `今週 ${formatWeekLoadHours(weekLoad.shortfallMinutes)}足りない。`;
    if (weekLoad.overCandidates.length === 0) return base;

    const candidatesText = weekLoad.overCandidates
        .map(c => {
            const [, month, day] = c.deadline.split('-');
            return `${c.title}(${parseInt(month, 10)}/${parseInt(day, 10)}, ${formatWeekLoadHours(c.estimatedMinutes)})`;
        })
        .join('／');

    return `${base}外す候補: ${candidatesText}`;
}
