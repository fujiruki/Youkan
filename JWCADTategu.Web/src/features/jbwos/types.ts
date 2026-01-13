export type JudgmentStatus = 'inbox' | 'scheduled' | 'waiting' | 'ready' | 'execution' | 'done' | 'pending' | 'archive' | 'today_commit' | 'confirmed' | 'decision_required' | 'decision_hold' | 'decision_rejected' | 'execution_in_progress' | 'execution_paused' | 'intent' | 'life';

export type DeadlineHook = 'today' | 'tomorrow' | 'this_week' | 'next_week' | 'someday';

export type JudgableItem = Item; // Alias for compatibility

export interface Item {
    id: string;              // UUID
    title: string;           // 表示名

    // --- JBWOS Core Properties ---
    status: JudgmentStatus;
    statusUpdatedAt: number; // 状態変更日（"今日"の判定用）

    // --- Filters & Sorters ---
    dueHook?: DeadlineHook;
    due_date?: string | null;  // "YYYY-MM-DD"
    due_status?: 'confirmed' | 'waiting_external';
    prep_date?: number | null; // [NEW] Preparation Target (Blurry Date, Timestamp)
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

    // --- Decision Layer Integration [NEW] ---
    type?: 'start' | 'material' | 'order' | 'estimate' | 'exception' | 'generic'; // Decision Type
    relatedId?: number;      // ID of the related entity (Door ID, etc.)
    resolved?: boolean;      // If strictly used for Decision log

    // Virtual Props (Computed)
    rdd?: number;            // Recommended Decision Date
    isOverdue?: boolean;

    // --- Intent Boost (Today Only) [NEW] ---
    is_boosted?: boolean;    // "今日だけ前に出す"
    boosted_date?: number;   // Boosted Date (for auto-reset check)

    // Legacy / Door Props
    category?: string;
    thumbnail?: string; // Base64 or URL
}

// Decision Table Schema Interface (Clean Architecture)
export interface Decision {
    id?: number;
    projectId: number;
    type: 'start' | 'material' | 'order' | 'estimate' | 'exception';
    relatedId?: number; // DoorID or ProductionID
    resolved: boolean;
    resolvedAt?: Date;
    note?: string;      // Exception reason etc.
    createdAt: Date;
}
// Side Memo Schema
export interface GdbShelf {
    active: Item[];
    preparation: Item[];
    intent: Item[]; // [NEW]
    log: Item[];
}
export interface SideMemo {
    id: string;
    content: string;
    createdAt: number;
}
