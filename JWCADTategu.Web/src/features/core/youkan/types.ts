import { EstimationSettings } from '../../plugins/tategu/domain/EstimationSettings';
import { DxfLayerConfig } from '../../plugins/tategu/domain/DxfConfig';

export type JudgmentStatus = 'inbox' | 'waiting' | 'focus' | 'pending' | 'done';

export type DeadlineHook = 'today' | 'tomorrow' | 'this_week' | 'next_week' | 'someday';
export type FilterMode = 'all' | 'company' | 'personal' | (string & {}); // string = tenantId

// --- View Context ---
export type Perspective = 'personal_private' | 'personal_company' | 'company_internal' | 'company_business';

export interface ViewContext {
    filterMode: FilterMode;
    /** 場面①〜④を表す */
    perspective: Perspective;
    /** 表示中の立場ラベル（例：「自分の時間管理」「○○社マネージャーとして」） */
    perspectiveLabel: string;
    /** フィルタで選択された特定の tenantId（A社選択時等） */
    focusedTenantId?: string | null;
}

// --- Youkan Enterprise Types ---
export type StockStatus = 'open' | 'assigned' | 'archived';

export interface StockJob {
    id: string;
    title: string;
    projectId?: string; // Link to projects.id (Deliverable ID)
    startDate?: number | null;
    estimatedMinutes: number;
    dueDate?: number | null;
    status: StockStatus;
    createdAt: number;
}

// const createProject = async ... (Removed unused function)
export interface Project {
    id?: number;
    title: string;           // Unified Title
    /** @deprecated Use title instead */
    name?: string;
    client?: string;      // Legacy
    clientName?: string;  // [NEW]
    settings?: EstimationSettings;
    dxfLayerConfig?: DxfLayerConfig;
    viewMode?: 'internal' | 'external' | 'mixed';
    judgmentStatus?: 'inbox' | 'decision_hold' | 'someday' | 'active' | 'waiting' | 'focus' | 'pending' | 'done';
    isArchived: boolean;
    grossProfitTarget: number;
    color?: string;       // [NEW]
    userId?: string;
    tenantId?: string;
    tenantName?: string;  // [NEW]
    assigned_to?: string; // [NEW] Link to assigned user
    assigneeName?: string; // [NEW]
    cloudId?: string;
    parentId?: string;    // [NEW] Sub-project support
    parentTitle?: string; // [NEW]
    createdAt: number;
    updatedAt: number;
}

export type JudgableItem = Item; // Alias for compatibility

export interface Member {
    id: string; // membership_id
    userId: string;
    display_name: string; // [Modified] Match backend column name
    email?: string; // [Modified] Optional to prevent build break on legacy usages
    role: string;
    isCore: boolean;
    isDefaultAssignee?: boolean; // [NEW] Default assignee for new projects/items
    dailyCapacityMinutes: number;
    capacityProfile?: CapacityProfile; // [NEW] Weekly pattern & exceptions
}

// [NEW] Multi-Tenant Capacity Logic
export interface WeeklyPattern {
    // Key: 0(Sun) - 6(Sat), Value: Minutes (e.g. 480)
    [day: number]: number;
}

export interface CapacityProfile {
    // 基準となる週間パターン（デフォルトはテナント設定または0）
    standardWeeklyPattern: WeeklyPattern;
    // [NEW] 曜日ごとの会社別配分
    defaultCompanyWeeklyPattern?: WeeklyCompanyPattern;
    // 日ごとの例外設定（YYYY-MM-DD -> Minutes）
    exceptions: { [dateStr: string]: number };
    // [NEW] 日ごとの会社別例外設定
    dailyCompanyExceptions?: Record<string, CompanyAllocation>;
}

export interface JoinedTenant {
    id: string; // tenant_id
    /** @deprecated Use title instead */
    name: string;
    title: string; // Unified Title
    role: string;
    description?: string; // [NEW]
    capacityProfile?: CapacityProfile; // [NEW] Personal capacity setting for this tenant
}

// [NEW] Item Flags (Attributes) - Haruki Model
export interface ItemFlags {
    has_deadline?: boolean;      // 期限あり
    needs_decision?: boolean;    // 判断待ち (情報不足)
    is_projectized?: boolean;    // プロジェクト化済み
    is_today_commit?: boolean;   // [Temporary] Today Commit flag (until Session DB)
    is_executing?: boolean;      // [Temporary] Execution flag
}

export interface Item {
    id: string;              // UUID
    title: string;           // 表示名

    // --- Youkan Core Properties ---
    status: JudgmentStatus;  // Strict 5 Statuses: inbox|waiting|ready|pending|done
    flags?: ItemFlags;       // [NEW] Attributes (is_today_commit, is_executing, etc)

    // [Youkan] Judgment Fields
    focusOrder: number;      // 0 = Unsorted/Inbox
    isEngaged: boolean;      // True = "Engaging/Driving" (Old: isIntent) - "今やっている"
    dueStatus?: 'today' | 'future' | 'overdue' | 'someday' | 'waiting_external' | 'confirmed'; // Temporal State

    statusUpdatedAt: number; // 状態変更日（"今日"の判定用）

    // --- Filters & Sorters ---
    dueHook?: DeadlineHook;
    due_date?: string | null;  // "YYYY-MM-DD"
    prep_date?: number | null; // [NEW] Preparation Target (Blurry Date, Timestamp)
    work_days?: number;        // [Legacy] 制作目安日数（デフォルト: 1）
    estimatedMinutes?: number; // [NEW] 制作目安時間（分）
    interrupt: boolean;      // 割り込みフラグ
    weight: 1 | 2 | 3;       // 1:Light, 2:Medium, 3:Heavy

    // --- Context ---
    projectId?: string | null;      // 案件ID（nullなら個人タスク）
    parentId?: string | null;       // [NEW] 親タスクID（Projectization）
    projectTitle?: string;   // [NEW] Parent Project Title (Joined)
    isProject?: boolean;     // [NEW] プロジェクト化されたコンテナフラグ
    projectCategory?: string; // [NEW] プロジェクト分類ID
    projectType?: 'general' | 'manufacturing' | string; // [NEW] Project Type for Unified Items
    tenantId?: string | null; // [NEW] To distinguish company vs personal
    tenantName?: string;      // [NEW] Display Name of the Tenant (for Badges)
    clientName?: string;      // [NEW] Client Name / Contractor for Business Items
    waitingReason?: string;  // status='waiting' の場合必須
    memo?: string;           // 横メモ（One-line reasoning）

    // --- Business Context [NEW] ---
    domain?: 'business' | 'general' | 'private'; // 業務区分
    pluginId?: string;       // 作成元プラグインID

    // --- Delegation (外注) [NEW] ---
    assignedTo?: string;     // 外注先の担当者ID
    assigneeName?: string;   // [NEW] Joined from assignees table
    assigneeColor?: string;  // [NEW] Joined from assignees table
    delegation?: DelegationInfo; // 外注詳細情報

    // --- Reference ---
    doorId?: string;         // 建具データへの参照（ある場合）

    createdAt: number;
    updatedAt: number;

    // --- Archive & Trash ---
    isArchived?: boolean;    // [NEW]
    deletedAt?: number | null; // [NEW] If set, it's in trash

    // --- Decision Layer Integration [NEW] ---
    type?: 'start' | 'material' | 'order' | 'estimate' | 'exception' | 'generic' | 'project'; // [NEW] 'project' type added
    relatedId?: number;      // ID of the related entity (Door ID, etc.)
    resolved?: boolean;      // If strictly used for Decision log
    rdd?: number;            // [Legacy/GDB] Requested Due Date (Unix Timestamp)

    // --- Priority Boost [NEW] ---
    is_boosted?: boolean;    // 優先度ブースト
    boosted_date?: number;   // ブースト設定日時
    created_by?: string;     // [NEW] Owner ID
    createdBy?: string;      // [NEW] Mapped Owner ID

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

export interface DailyLog {
    id: string;
    date: string; // YYYY-MM-DD
    category: string; // 'life', 'execution'
    content: string;
    createdAt: number;
    projectId?: string;
    itemId?: string;
    durationMinutes?: number;
    grossProfitShare?: number;
    projectTitle?: string;
    projectColor?: string;
}

// --- Holiday & Capacity Configuration ---
export type WeekDay = 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0=Sun, 1=Mon...

export interface HolidayRule {
    type: 'weekly' | 'specific' | 'pattern';
    value: string | number; // "0" (Sun), "2026-01-01", "2-1" (2nd Mon)
    label?: string; // "定休日", "元日"
}

export interface CompanyAllocation {
    [companyId: string]: number; // 分単位の持ち時間
}

export interface WeeklyCompanyPattern {
    [day: number]: CompanyAllocation; // 曜日ごとの配分 (0:日〜6:土)
}

export interface CapacityConfig {
    defaultDailyMinutes: number; // e.g. 480 (8h)
    holidays: HolidayRule[];
    exceptions: Record<string, number>; // "2026-01-20": 240 (Half day)
    standardWeeklyPattern?: WeeklyPattern; // [NEW] 曜日ごとの基本稼働時間
    defaultCompanyWeeklyPattern?: WeeklyCompanyPattern; // [NEW] 曜日ごとの会社別配分
    dailyCompanyExceptions?: Record<string, CompanyAllocation>; // [NEW] 日ごとの会社別例外設定
}

// --- Delegation (外注) [NEW] ---
export interface DelegationInfo {
    assignedTo: string;      // 担当者ID
    assignedAt: number;      // 依頼日時
    dueDate?: string;        // 期限 (YYYY-MM-DD)
    completedAt?: number;    // 完了日時
    note?: string;           // 外注先への指示
}

export interface Assignee {
    id: string;
    name: string;            // "太郎さん"
    type: 'internal' | 'external';  // 社内/社外
    color?: string;          // [NEW] Badge background color
    contact?: string;        // 連絡先
    createdAt: number;
}

// --- Project Categories [NEW] ---
export interface TaskTemplate {
    title: string;
    estimatedMinutes?: number;
    category?: string;
    description?: string;
}

export interface ProjectCategory {
    id: string;
    /** @deprecated Use title instead */
    name?: string;
    title: string;           // [NEW] Unified Title
    icon?: string;
    defaultTasks: TaskTemplate[];
    pluginId?: string;       // "tategu-plugin"
    domain?: 'business' | 'general' | 'private'; // デフォルトドメイン
    color?: string;
    isCustom?: boolean;
    createdAt: number;
}

// --- Plugin System [NEW] ---
export interface PluginSettings {
    [key: string]: any;
}

export interface PluginManifest {
    id: string;
    name: string;
    version: string;
    description: string;
    icon?: string;
    projectCategories?: ProjectCategory[];
    settings?: PluginSettings;
    enabled: boolean;
    installedAt?: number;
}

// --- Manufacturing Bus (External Import) [NEW] ---
export interface ExternalItem {
    id: string;              // External ID (e.g. "factory-123")
    title: string;           // Display Name
    description?: string;    // Detail
    thumbnail?: string;      // Image URL
    sourceId: string;        // Source Identifier (e.g. "mock-factory")
    metadata?: any;          // Extra data for import
}


export interface ExternalSource {
    id: string;              // "mock-factory"
    name: string;            // "Mock Factory"
    icon?: string;           // "🏭"
    items: ExternalItem[];   // Available items to import
}

export interface ManufacturingPlugin {
    id: string;
    name: string;
    getSources(): Promise<ExternalSource[]>;
    // Optional: Capability to handle import/sync
    onImport?(item: ExternalItem): Promise<void>;
}
