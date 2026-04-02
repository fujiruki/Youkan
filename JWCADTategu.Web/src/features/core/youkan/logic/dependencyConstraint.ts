import { Dependency } from '../types';

interface ItemDateInfo {
    id: string;
    prep_date: number | null; // Unix timestamp（秒）
    due_date: string | null;  // ISO日付文字列
}

interface DateUpdate {
    prep_date?: number;
    due_date?: string;
}

interface ValidationResult {
    valid: boolean;
    reason?: string;
}

interface CascadeAdjustment {
    itemId: string;
    prep_date?: number;
    due_date?: string;
}

const dateToStartOfDay = (d: Date): Date => {
    const r = new Date(d);
    r.setHours(0, 0, 0, 0);
    return r;
};

const parseDueDate = (due: string): Date =>
    dateToStartOfDay(new Date(due + 'T00:00:00'));

const unixToDate = (ts: number): Date =>
    dateToStartOfDay(new Date(ts * 1000));

const dateToUnix = (d: Date): number =>
    dateToStartOfDay(d).getTime() / 1000;

const dateToISO = (d: Date): string => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
};

/**
 * 依存関係の日程制約バリデーション
 *
 * source（前提タスク）→ target（後続タスク）の関係で:
 * - 後続のprep_date >= 前提のdue_date であること
 */
export function validateDependencyConstraint(
    itemId: string,
    updates: DateUpdate,
    items: ItemDateInfo[],
    dependencies: Dependency[]
): ValidationResult {
    const itemMap = new Map(items.map(i => [i.id, i]));

    // prep_dateの更新 → このアイテムが「後続タスク」の場合をチェック
    if (updates.prep_date !== undefined) {
        const newPrepDate = unixToDate(updates.prep_date);

        // このアイテムがtarget（後続）である依存関係を取得
        const asTarget = dependencies.filter(d => d.targetItemId === itemId);
        for (const dep of asTarget) {
            const source = itemMap.get(dep.sourceItemId);
            if (!source?.due_date) continue;

            const sourceDueDate = parseDueDate(source.due_date);
            if (newPrepDate < sourceDueDate) {
                return {
                    valid: false,
                    reason: `前提タスクの完了予定日(${source.due_date})より前に配置できません`,
                };
            }
        }
    }

    // due_dateの更新 → このアイテムが「前提タスク」の場合をチェック
    if (updates.due_date !== undefined) {
        const newDueDate = parseDueDate(updates.due_date);

        // このアイテムがsource（前提）である依存関係を取得
        const asSource = dependencies.filter(d => d.sourceItemId === itemId);
        for (const dep of asSource) {
            const target = itemMap.get(dep.targetItemId);
            if (!target?.prep_date) continue;

            const targetPrepDate = unixToDate(target.prep_date);
            if (newDueDate > targetPrepDate) {
                return {
                    valid: false,
                    reason: `後続タスクの開始日より後に完了予定日を設定できません`,
                };
            }
        }
    }

    return { valid: true };
}

/**
 * 依存関係に基づく自動日程調整（カスケード）
 *
 * 前提タスクの日程が後ろにずれた場合、後続タスクも連動してずれる。
 * 元の間隔を維持する。前にずれた場合はカスケードしない。
 */
export function calculateCascadeAdjustments(
    itemId: string,
    updates: DateUpdate,
    items: ItemDateInfo[],
    dependencies: Dependency[]
): CascadeAdjustment[] {
    if (updates.due_date === undefined) return [];

    const itemMap = new Map(items.map(i => [i.id, i]));
    const item = itemMap.get(itemId);
    if (!item?.due_date) return [];

    const oldDueDate = parseDueDate(item.due_date);
    const newDueDate = parseDueDate(updates.due_date);

    const diffMs = newDueDate.getTime() - oldDueDate.getTime();
    if (diffMs <= 0) return [];

    const adjustments: CascadeAdjustment[] = [];
    const visited = new Set<string>();
    const queue: Array<{ id: string; shiftMs: number }> = [];

    // 直接の後続タスクをキューに追加
    const directTargets = dependencies.filter(d => d.sourceItemId === itemId);
    for (const dep of directTargets) {
        queue.push({ id: dep.targetItemId, shiftMs: diffMs });
    }

    while (queue.length > 0) {
        const { id: currentId, shiftMs } = queue.shift()!;
        if (visited.has(currentId)) continue;
        visited.add(currentId);

        const current = itemMap.get(currentId);
        if (!current?.prep_date) continue;

        const adj: CascadeAdjustment = { itemId: currentId };

        // prep_dateをずらす
        const oldPrep = unixToDate(current.prep_date);
        const newPrep = new Date(oldPrep.getTime() + shiftMs);
        adj.prep_date = dateToUnix(newPrep);

        // due_dateもずらす（存在する場合）
        if (current.due_date) {
            const oldDue = parseDueDate(current.due_date);
            const newDue = new Date(oldDue.getTime() + shiftMs);
            adj.due_date = dateToISO(newDue);
        }

        adjustments.push(adj);

        // さらに後続をキューに追加
        const nextTargets = dependencies.filter(d => d.sourceItemId === currentId);
        for (const dep of nextTargets) {
            if (!visited.has(dep.targetItemId)) {
                queue.push({ id: dep.targetItemId, shiftMs });
            }
        }
    }

    return adjustments;
}
