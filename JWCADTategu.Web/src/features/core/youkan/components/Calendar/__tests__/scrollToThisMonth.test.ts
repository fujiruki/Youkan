import { describe, it, expect } from 'vitest';

/**
 * R-007: ガントチャート「今月を表示」中央スクロール改善テスト
 *
 * scrollToCurrentMonth関数のロジックを単体テストする:
 * - 横方向: 今月が表示領域の中央に来るスクロール位置を計算
 * - 縦方向: 今月が目安期間に含まれるアイテム群が中央に来るスクロール位置を計算
 */

interface MockItem {
    id: string;
    prep_date: number | null; // Unix timestamp (seconds)
    due_date: string | null;  // ISO 8601
}

/**
 * 横方向スクロール位置を計算する
 * 今月の1日の列インデックスから表示領域中央に来るスクロール位置を算出
 */
function calcHorizontalScrollPosition(
    allDays: Date[],
    today: Date,
    containerWidth: number,
    colWidth: number
): number {
    const thisMonthFirstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    const thisMonthLastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);

    const firstIndex = allDays.findIndex(d =>
        d.getFullYear() === thisMonthFirstDay.getFullYear() &&
        d.getMonth() === thisMonthFirstDay.getMonth() &&
        d.getDate() === thisMonthFirstDay.getDate()
    );
    const lastIndex = allDays.findIndex(d =>
        d.getFullYear() === thisMonthLastDay.getFullYear() &&
        d.getMonth() === thisMonthLastDay.getMonth() &&
        d.getDate() === thisMonthLastDay.getDate()
    );

    if (firstIndex === -1) return 0;
    const effectiveLastIndex = lastIndex === -1 ? firstIndex : lastIndex;

    const monthCenterPx = ((firstIndex + effectiveLastIndex) / 2) * colWidth;
    return Math.max(0, monthCenterPx - containerWidth / 2 + colWidth / 2);
}

/**
 * 縦方向スクロール位置を計算する
 * 今月が目安期間(prep_date)〜顧客納期(due_date)に含まれるアイテムのインデックス群から中央位置を算出
 */
function calcVerticalScrollPosition(
    items: MockItem[],
    today: Date,
    rowHeight: number,
    containerHeight: number
): number {
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    monthEnd.setHours(23, 59, 59, 999);

    const matchingIndices: number[] = [];

    items.forEach((item, index) => {
        const prepDate = item.prep_date ? new Date(item.prep_date * 1000) : null;
        const dueDate = item.due_date ? new Date(item.due_date) : null;

        const rangeStart = dueDate || prepDate;
        const rangeEnd = prepDate || dueDate;

        if (!rangeStart && !rangeEnd) return;

        const itemStart = rangeStart && rangeEnd
            ? (rangeStart < rangeEnd ? rangeStart : rangeEnd)
            : (rangeStart || rangeEnd)!;
        const itemEnd = rangeStart && rangeEnd
            ? (rangeStart > rangeEnd ? rangeStart : rangeEnd)
            : (rangeStart || rangeEnd)!;

        const overlaps = itemStart <= monthEnd && itemEnd >= monthStart;
        if (overlaps) {
            matchingIndices.push(index);
        }
    });

    if (matchingIndices.length === 0) return 0;

    const firstMatch = matchingIndices[0];
    const lastMatch = matchingIndices[matchingIndices.length - 1];
    const centerIndex = (firstMatch + lastMatch) / 2;
    const centerPx = centerIndex * rowHeight;
    return Math.max(0, centerPx - containerHeight / 2 + rowHeight / 2);
}

describe('R-007: 「今月を表示」中央スクロール計算', () => {
    const colWidth = 24;
    const rowHeight = 40;

    describe('横方向スクロール', () => {
        it('今月が表示領域の中央に来るスクロール位置を返すこと', () => {
            const today = new Date(2026, 2, 15); // 2026年3月
            const allDays: Date[] = [];
            // 2026年1月〜5月の日付を生成
            for (let m = 0; m < 5; m++) {
                const daysInMonth = new Date(2026, m + 1, 0).getDate();
                for (let d = 1; d <= daysInMonth; d++) {
                    allDays.push(new Date(2026, m, d));
                }
            }

            const containerWidth = 800;
            const scrollPos = calcHorizontalScrollPosition(allDays, today, containerWidth, colWidth);

            // 3月1日は1月(31日)+2月(28日)=59日目 (index 59)
            // 3月31日はindex 89
            // 月の中央: (59+89)/2 = 74
            // 中央px: 74 * 24 = 1776
            // scrollPos = 1776 - 800/2 + 24/2 = 1776 - 400 + 12 = 1388
            expect(scrollPos).toBe(1388);
        });

        it('今月がallDaysに含まれない場合は0を返すこと', () => {
            const today = new Date(2026, 11, 15); // 12月
            const allDays = [new Date(2026, 0, 1)]; // 1月のみ

            const scrollPos = calcHorizontalScrollPosition(allDays, today, 800, colWidth);
            expect(scrollPos).toBe(0);
        });
    });

    describe('縦方向スクロール', () => {
        it('今月の目安期間に含まれるアイテム群の中央位置を返すこと', () => {
            const today = new Date(2026, 2, 15); // 3月

            const items: MockItem[] = [
                { id: '1', prep_date: new Date(2026, 0, 15).getTime() / 1000, due_date: null }, // 1月 → 対象外
                { id: '2', prep_date: new Date(2026, 2, 10).getTime() / 1000, due_date: '2026-03-20' }, // 3月 → 対象
                { id: '3', prep_date: new Date(2026, 2, 25).getTime() / 1000, due_date: null }, // 3月 → 対象
                { id: '4', prep_date: new Date(2026, 5, 1).getTime() / 1000, due_date: null },  // 6月 → 対象外
            ];

            const containerHeight = 600;
            const scrollPos = calcVerticalScrollPosition(items, today, rowHeight, containerHeight);

            // 対象アイテム: index 1 と index 2
            // 中央index: (1+2)/2 = 1.5
            // 中央px: 1.5 * 40 = 60
            // scrollPos = 60 - 300 + 20 = max(0, -220) = 0
            expect(scrollPos).toBe(0);
        });

        it('対象アイテムがない場合は0を返すこと', () => {
            const today = new Date(2026, 2, 15);
            const items: MockItem[] = [
                { id: '1', prep_date: new Date(2026, 0, 15).getTime() / 1000, due_date: null },
            ];

            const scrollPos = calcVerticalScrollPosition(items, today, rowHeight, 600);
            expect(scrollPos).toBe(0);
        });

        it('多数のアイテムがある場合、中央のアイテム群にスクロールすること', () => {
            const today = new Date(2026, 2, 15);

            // 100個のアイテムを生成。index 40〜60が3月に含まれる
            const items: MockItem[] = [];
            for (let i = 0; i < 100; i++) {
                const month = Math.floor(i / 20); // 0〜4月
                items.push({
                    id: String(i),
                    prep_date: new Date(2026, month, 15).getTime() / 1000,
                    due_date: null
                });
            }

            const containerHeight = 200;
            const scrollPos = calcVerticalScrollPosition(items, today, rowHeight, containerHeight);

            // 3月のアイテム: index 40〜59
            // 中央: (40+59)/2 = 49.5
            // 中央px: 49.5 * 40 = 1980
            // scrollPos = 1980 - 100 + 20 = 1900
            expect(scrollPos).toBe(1900);
        });
    });
});
