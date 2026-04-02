import { describe, it, expect } from 'vitest';
import {
    validateDependencyConstraint,
    calculateCascadeAdjustments,
} from '../dependencyConstraint';
import { Dependency } from '../../types';

/**
 * 依存関係の日程制約バリデーションテスト
 *
 * source（前提タスク）→ target（後続タスク）の依存関係において:
 * - 後続タスクの開始日(prep_date)は、前提タスクの完了日(due_date)以降でなければならない
 * - 前提タスクの完了日は、後続タスクの開始日より前でなければならない
 */

interface SimpleItem {
    id: string;
    prep_date: number | null; // Unix timestamp（秒）
    due_date: string | null;  // ISO日付文字列
}

const toUnix = (y: number, m: number, d: number) =>
    new Date(y, m - 1, d).getTime() / 1000;

const toISO = (y: number, m: number, d: number) => {
    const mm = String(m).padStart(2, '0');
    const dd = String(d).padStart(2, '0');
    return `${y}-${mm}-${dd}`;
};

describe('依存関係の日程制約バリデーション', () => {
    const deps: Dependency[] = [
        { id: 'dep-1', sourceItemId: 'A', targetItemId: 'B', createdAt: 0 },
    ];

    it('後続タスクBのprep_dateを前提タスクAのdue_dateより前に設定できない', () => {
        const items: SimpleItem[] = [
            { id: 'A', prep_date: null, due_date: toISO(2026, 4, 10) },
            { id: 'B', prep_date: toUnix(2026, 4, 12), due_date: null },
        ];

        // Bのprep_dateを4/9に移動 → 制約違反
        const result = validateDependencyConstraint(
            'B',
            { prep_date: toUnix(2026, 4, 9) },
            items,
            deps
        );
        expect(result.valid).toBe(false);
        expect(result.reason).toContain('前提タスク');
    });

    it('後続タスクBのprep_dateを前提タスクAのdue_dateと同日に設定できる', () => {
        const items: SimpleItem[] = [
            { id: 'A', prep_date: null, due_date: toISO(2026, 4, 10) },
            { id: 'B', prep_date: toUnix(2026, 4, 12), due_date: null },
        ];

        // Bのprep_dateを4/10に移動 → OK（同日は許可）
        const result = validateDependencyConstraint(
            'B',
            { prep_date: toUnix(2026, 4, 10) },
            items,
            deps
        );
        expect(result.valid).toBe(true);
    });

    it('前提タスクAのdue_dateを後続タスクBのprep_dateより後に設定できない', () => {
        const items: SimpleItem[] = [
            { id: 'A', prep_date: null, due_date: toISO(2026, 4, 5) },
            { id: 'B', prep_date: toUnix(2026, 4, 5), due_date: null },
        ];

        // Aのdue_dateを4/6に移動 → 制約違反（Bのprep_dateは4/5）
        const result = validateDependencyConstraint(
            'A',
            { due_date: toISO(2026, 4, 6) },
            items,
            deps
        );
        expect(result.valid).toBe(false);
        expect(result.reason).toContain('後続タスク');
    });

    it('依存関係のないアイテムの日程変更は常にOK', () => {
        const items: SimpleItem[] = [
            { id: 'C', prep_date: toUnix(2026, 4, 10), due_date: null },
        ];

        const result = validateDependencyConstraint(
            'C',
            { prep_date: toUnix(2026, 3, 1) },
            items,
            deps
        );
        expect(result.valid).toBe(true);
    });
});

describe('依存関係に基づく自動日程調整（カスケード）', () => {
    it('前提タスクが後ろにずれた場合、後続タスクも連動してずれる', () => {
        const deps: Dependency[] = [
            { id: 'dep-1', sourceItemId: 'A', targetItemId: 'B', createdAt: 0 },
        ];
        const items: SimpleItem[] = [
            { id: 'A', prep_date: null, due_date: toISO(2026, 4, 10) },
            { id: 'B', prep_date: toUnix(2026, 4, 12), due_date: toISO(2026, 4, 15) },
        ];

        // Aのdue_dateを4/13に移動（3日後ろにずれ）
        const adjustments = calculateCascadeAdjustments(
            'A',
            { due_date: toISO(2026, 4, 13) },
            items,
            deps
        );

        // Bのprep_dateも3日ずれる: 4/12 → 4/15
        const bAdj = adjustments.find(a => a.itemId === 'B');
        expect(bAdj).toBeDefined();
        expect(bAdj!.prep_date).toBe(toUnix(2026, 4, 15));
        // Bのdue_dateも3日ずれる: 4/15 → 4/18
        expect(bAdj!.due_date).toBe(toISO(2026, 4, 18));
    });

    it('連鎖的な調整: A→B→C でAがずれたらBもCもずれる', () => {
        const deps: Dependency[] = [
            { id: 'dep-1', sourceItemId: 'A', targetItemId: 'B', createdAt: 0 },
            { id: 'dep-2', sourceItemId: 'B', targetItemId: 'C', createdAt: 0 },
        ];
        const items: SimpleItem[] = [
            { id: 'A', prep_date: null, due_date: toISO(2026, 4, 5) },
            { id: 'B', prep_date: toUnix(2026, 4, 7), due_date: toISO(2026, 4, 10) },
            { id: 'C', prep_date: toUnix(2026, 4, 12), due_date: toISO(2026, 4, 15) },
        ];

        // Aのdue_dateを4/8に移動（3日後ろにずれ）
        const adjustments = calculateCascadeAdjustments(
            'A',
            { due_date: toISO(2026, 4, 8) },
            items,
            deps
        );

        // Bは3日ずれる: prep 4/7→4/10, due 4/10→4/13
        const bAdj = adjustments.find(a => a.itemId === 'B');
        expect(bAdj).toBeDefined();
        expect(bAdj!.prep_date).toBe(toUnix(2026, 4, 10));
        expect(bAdj!.due_date).toBe(toISO(2026, 4, 13));

        // Cも3日ずれる: prep 4/12→4/15, due 4/15→4/18
        const cAdj = adjustments.find(a => a.itemId === 'C');
        expect(cAdj).toBeDefined();
        expect(cAdj!.prep_date).toBe(toUnix(2026, 4, 15));
        expect(cAdj!.due_date).toBe(toISO(2026, 4, 18));
    });

    it('前提タスクが前にずれた場合はカスケード調整しない', () => {
        const deps: Dependency[] = [
            { id: 'dep-1', sourceItemId: 'A', targetItemId: 'B', createdAt: 0 },
        ];
        const items: SimpleItem[] = [
            { id: 'A', prep_date: null, due_date: toISO(2026, 4, 10) },
            { id: 'B', prep_date: toUnix(2026, 4, 12), due_date: null },
        ];

        // Aのdue_dateを4/8に移動（前にずれ → 制約は緩くなるのでカスケード不要）
        const adjustments = calculateCascadeAdjustments(
            'A',
            { due_date: toISO(2026, 4, 8) },
            items,
            deps
        );

        expect(adjustments).toHaveLength(0);
    });

    it('後続タスクにprep_dateがない場合はスキップ', () => {
        const deps: Dependency[] = [
            { id: 'dep-1', sourceItemId: 'A', targetItemId: 'B', createdAt: 0 },
        ];
        const items: SimpleItem[] = [
            { id: 'A', prep_date: null, due_date: toISO(2026, 4, 10) },
            { id: 'B', prep_date: null, due_date: null },
        ];

        const adjustments = calculateCascadeAdjustments(
            'A',
            { due_date: toISO(2026, 4, 15) },
            items,
            deps
        );

        expect(adjustments).toHaveLength(0);
    });
});
