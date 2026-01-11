export type JudgmentStatus = 'inbox' | 'waiting' | 'ready' | 'pending' | 'done';

export type DeadlineHook = 'today' | 'tomorrow' | 'this_week' | 'next_week' | 'someday';

export interface Item {
    id: string;              // UUID
    title: string;           // 表示名

    // --- JBWOS Core Properties ---
    status: JudgmentStatus;
    statusUpdatedAt: number; // 状態変更日（"今日"の判定用）

    // --- Filters & Sorters ---
    dueHook?: DeadlineHook;
    interrupt: boolean;      // 割り込みフラグ
    weight: 1 | 2 | 3;       // 1:Light, 2:Medium, 3:Heavy

    // --- Context ---
    projectId?: string;      // 案件ID（nullなら個人タスク）
    waitingReason?: string;  // status='waiting' の場合必須
    memo?: string;           // 横メモ（One-line reasoning）

    // --- Reference ---
    doorId?: string;         // 建具データへの参照（ある場合）

    createdAt: number;
    updatedAt: number;
}
