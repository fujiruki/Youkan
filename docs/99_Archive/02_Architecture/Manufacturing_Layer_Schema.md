# Manufacturing Layer Schema Definition

"Manufacturing Layer" (共通バス) のデータ構造定義書です。
Core (JBWOS) と Plugin (Tategu/Furniture) を繋ぐための厳格な契約(Contract)となります。

## 1. Concepts

*   **Manifest (マニフェスト)**: プロジェクトごとの「作りたいものリスト」。JBWOSのItemとは別に管理される、製造業特有のマスターデータ。
*   **Deliverable (成果物)**: マニフェストに含まれる個々のアイテム（建具A、家具B、現場作業Cなど）。
*   **Aggregation (集計)**: Deliverableから吸い上げた数値（時間、金）の合計。

## 2. Core Interfaces

### Manufacturing Manifest
プロジェクト1つにつき、1つのManifestが存在します。

```typescript
interface ManufacturingManifest {
    projectId: string; // JBWOS Project ID
    deliverables: Deliverable[];
    
    // Aggregates (Computed)
    totalCost: number;       // 原価合計
    totalPrice: number;      // 見積金額合計（参考）
    totalFactoryTime: number; // 工場製作時間 (分)
    totalSiteTime: number;    // 現場作業時間 (分)
    updatedAt: number;
}
```

### Deliverable (The "Make Item")
プラグインが生成し、Manufacturing Layerが管理する最小単位です。

```typescript
type DeliverableType = 'product' | 'work' | 'part';

interface Deliverable {
    id: string;              // UUID
    pluginId: string;        // 'tategu-plugin', 'furniture-plugin'
    type: DeliverableType;   // 'product' (モノ), 'work' (作業)
    
    // Basic Info
    name: string;            // "框戸A", "搬入作業"
    quantity: number;        // 数量
    
    // Links
    relatedTaskId?: string;  // JBWOS Item ID (Task)
    
    // The "Bus" Data (Common Interface for Aggregation)
    cost: {
        material: number;    // 材料費
        labor: number;       // 加工費
        other: number;       // 経費
        total: number;       // 原価計
    };
    
    time: {
        factoryMinutes: number; // 工場での製作時間
        siteMinutes: number;    // 現場での取付・作業時間
    };
    
    // Plugin Specific Data (Opaque to Core)
    // Coreはこの中身を知らなくても良いし、Pluginは好きに使って良い
    pluginData: any; 
}
```

## 3. Plugin Interface
各プラグインが実装すべきメソッド定義です。

```typescript
interface ManufacturingPlugin {
    id: string; // 'tategu', 'furniture'
    name: string;
    
    // 1. Editor
    // 成果物を編集するためのUIコンポーネントを提供する
    // (React Component or URL)
    renderEditor(deliverable: Deliverable): React.ReactNode;
    
    // 2. Logic
    // プラグイン固有データから、共通フォーマット(Deliverable)への変換
    calculateDeliverable(data: any): { cost: Cost; time: Time };
    
    // 3. Templates
    // 初期セットアップ用
    getDefaultManifest(): Deliverable[];
}
```

## 4. Workflow Implementation

### A. Automatic Task Sync
Manifest に `Deliverable` が追加・更新されると、Manufacturing Layer は以下を実行します。

1.  **Check**: `relatedTaskId` があるか？
2.  **Create (if null)**:
    *   JBWOSに新規Itemを作成 (`title`: `name` + "の製作/実施")。
    *   Item ID を `relatedTaskId` に保存。
3.  **Update**:
    *   Itemの `work_days` (目安) を `time.factoryMinutes` などから算出して更新。
    *   Itemのメモに `cost.total` などを反映（オプション）。

### B. Aggregation Display
プロジェクト詳細画面（またはManifest View）のフッターに、Manifestから計算した `totalSiteTime` を表示します。これが「現場作業時間」として職人のスケジュール判断に使われます。

---

このスキーマにより、**「建具プラグインが計算した取付時間」** と **「家具プラグインが計算した搬入時間」** が、`time.siteMinutes` という共通言語で足し算可能になります。
