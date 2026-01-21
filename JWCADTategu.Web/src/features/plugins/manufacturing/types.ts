/**
 * Manufacturing Plugin - Data Types
 * 
 * 製造業向けプラグインのデータ型定義
 */

/**
 * 成果物タイプ
 * - product: 製作物（工場で作る）
 * - service: 現場作業（取付、修理など）
 */
export type DeliverableType = 'product' | 'service';

/**
 * 成果物ステータス
 */
export type DeliverableStatus = 'pending' | 'in_progress' | 'completed';

/**
 * 成果物（Deliverable）
 * Manifest（拾い出しリスト）の各アイテム
 */
export interface Deliverable {
    id: string;
    projectId: string;            // 親プロジェクトID（JBWOS Item.id）
    linkedItemId?: string;        // 自動生成されたJBWOSタスクへのリンク

    name: string;                 // 成果物名（例: "リビングドア"）
    type: DeliverableType;        // 製作物 or 現場作業

    // 時間（見積）
    estimatedWorkMinutes: number;   // 製作時間（分）
    estimatedSiteMinutes: number;   // 現場時間（分）

    // 時間（実績）
    actualWorkMinutes?: number;     // 実績製作時間
    actualSiteMinutes?: number;     // 実績現場時間

    // 原価（任意・アバウト入力OK）
    laborRate?: number;             // [NEW] 労務単価
    materialCost?: number;          // 材料費
    laborCost?: number;             // 労務費 (Total)
    otherCost?: number;             // [NEW] その他経費
    outsourceCost?: number;         // 外注費 (Legacy? Keep for compatibility or alias to otherCost)

    // メタデータ
    description?: string;           // [NEW] 公開説明
    note?: string;                  // [NEW] 社内メモ
    memo?: string;                  // [Legacy] -> map to note

    photos?: string[];              // [NEW] 完成写真 (Blob IDs)

    // 必須プロパティ
    status: DeliverableStatus;      // [NEW] ステータス
    requiresSiteInstallation: boolean;

    statusUpdatedAt?: number;       // ステータス変更日時

    pluginData?: Record<string, any>; // 他プラグイン連携用データ

    createdAt: number;
    updatedAt: number;
}

/**
 * 製造業プロジェクト
 * JBWOS CoreのプロジェクトにManufacturingデータを紐付け
 */
export interface ManufacturingProject {
    itemId: string;               // JBWOS Core のプロジェクトID
    customerId?: string;          // Customer Plugin連携（任意）

    // 集計キャッシュ（パフォーマンス用）
    totalEstimatedWorkMinutes?: number;
    totalEstimatedSiteMinutes?: number;
    totalMaterialCost?: number;

    createdAt: number;
    updatedAt: number;
}

/**
 * 成果物作成リクエスト
 */
export type DeliverableCreateRequest = Omit<Deliverable, 'id' | 'createdAt' | 'updatedAt' | 'linkedItemId'>;

/**
 * 成果物更新リクエスト
 */
export type DeliverableUpdateRequest = Partial<DeliverableCreateRequest>;

/**
 * プロジェクト集計情報
 */
export interface ProjectSummary {
    projectId: string;
    deliverableCount: number;
    totalEstimatedWorkMinutes: number;
    totalEstimatedSiteMinutes: number;
    totalActualWorkMinutes: number;
    totalActualSiteMinutes: number;
    totalMaterialCost: number;
    totalLaborCost: number;
    totalOutsourceCost: number;
    completedCount: number;
    inProgressCount: number;
    pendingCount: number;
}
