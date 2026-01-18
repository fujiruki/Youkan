# JBWOS Plugin Architecture 詳細設計書

## 1. 全体構成

```
JBWOS Core（汎用タスク管理）
  │
  ├── Customer Plugin（顧客管理）【独立・優先度1】
  ├── Billing Plugin（見積・請求）【独立・1年後】
  ├── Inventory Plugin（材料・仕入先）【独立・1年後】
  │
  └── Manufacturing Plugin（製造業向け）【優先度2】
        └── Tategu Plugin（建具向け）【優先度3】
```

### バンドルパック（将来）
- **建具屋スターターパック** = Customer + Manufacturing + Tategu
- **フリーランスパック** = Customer + Billing

---

## 1.5 設計決定事項

| 決定 | 内容 |
|---|---|
| **プロジェクト種類** | 「製造業プロジェクト」を選択可能にする |
| **Customer Plugin依存** | なくても動作する。顧客なしでも可 |
| **姿図CAD** | 単体で動作可能にする（試用・デモ用） |
| **名称統一** | ~~TateguDoor~~ → `Tategu`（建具=Doorなので重複） |
| **プラグイン拡張** | Billing単体=手入力のみ、Manufacturing追加=労務時間・材料からの自動算出が追加される |
| **原価入力** | 材料リストなくてもアバウトに直接入力可能 |

---

## 2. Customer Plugin（顧客管理）

### 2.1 機能一覧

| 機能 | 説明 | 優先度 |
|---|---|---|
| 顧客登録 | 名前、住所、電話、メール、メモ | 高 |
| 顧客一覧 | 検索・フィルタ付き一覧表示 | 高 |
| 締め日管理 | 顧客ごとの締め日（月末/20日など） | 中 |
| 繰越金管理 | 前月からの繰越金額 | 中 |
| **掛売上/現金売上** | 顧客ごとのデフォルト設定 | 中 |
| 顧客別履歴 | その顧客のプロジェクト・取引履歴 | 低 |

### 2.2 データ構造

```typescript
interface Customer {
    id: string;
    name: string;          // 顧客名（個人名 or 会社名）
    nameKana?: string;     // フリガナ
    address?: string;      // 住所
    phone?: string;        // 電話番号
    email?: string;        // メールアドレス
    
    // 請求設定（デフォルト）
    closingDay?: number;   // 締め日（1-31、0=月末）
    paymentType: 'credit' | 'cash'; // 掛売上 or 現金売上
    carryOver?: number;    // 繰越金額
    
    memo?: string;         // メモ
    createdAt: number;
    updatedAt: number;
}
```

### 2.3 売上ごとの請求設定

> **重要**: 顧客のデフォルト設定は `Customer.paymentType` だが、**売上ごとに上書き可能**

```typescript
// Billing Plugin側（将来実装）
interface Sale {
    customerId?: string;
    
    // 請求設定（売上単位で上書き可能）
    paymentType: 'credit' | 'cash'; // この売上の支払タイプ
    billingDate?: string;           // 請求日（締め日と異なる場合に指定）
    // ...
}
```

### 2.4 JBWOS Coreとの連携

- プロジェクト（Item with isProject=true）に `customerId` を紐付け可能
- 顧客を選択すると、その顧客のプロジェクト一覧を表示

---

## 2.5 Inventory Plugin（材料・金物・仕入先）【1年後】

> **注意**: このPluginは1年後の実装予定。ここでは将来設計のメモとして記載。

### 2.5.1 機能一覧

| 機能 | 説明 | 優先度 |
|---|---|---|
| 金物リスト | 画像、仕入れ値、仕入先、定価、名前、型番、色 | 中 |
| 板材料リスト | 画像、仕入れ値、仕入先、定価、名前、型番、縦幅、横幅、厚み、色 | 中 |
| 仕入先リスト | 仕入先の管理、発注コピペ（LINE送信等） | 中 |
| **金物の時間管理** | 加工時間・現場取付時間を別々に管理 | 中 |

### 2.5.2 金物の時間管理

> **重要**: 金物には「加工時間」と「現場取付時間」を**別々に**入力する

```typescript
interface Hardware {
    id: string;
    name: string;           // 金物名
    modelNumber?: string;   // 型番
    color?: string;         // 色
    imageUrl?: string;      // 画像
    
    // 仕入情報
    supplierId?: string;    // 仕入先
    purchasePrice: number;  // 仕入れ値
    listPrice?: number;     // 定価
    
    // 時間（重要！）
    processingMinutes: number;     // 加工時間（工場）→ 製造時間に加算
    installationMinutes: number;   // 現場取付時間 → 現場時間に加算
}

interface BoardMaterial {
    id: string;
    name: string;
    modelNumber?: string;
    color?: string;
    imageUrl?: string;
    
    // 寸法
    width: number;          // 横幅(mm)
    height: number;         // 縦幅(mm)
    thickness: number;      // 厚み(mm)
    
    // 仕入情報
    supplierId?: string;
    purchasePrice: number;
    listPrice?: number;
}
```

### 2.5.3 成果物への時間集計

製作物（Deliverable）に金物を使用する場合：

```typescript
interface DeliverableHardwareUsage {
    deliverableId: string;
    hardwareId: string;
    quantity: number;
    
    // 現場取付チェック
    requiresSiteInstallation: boolean;  // チェックあり → 現場取付時間を集計
}
```

**集計ロジック**:
- `hardware.processingMinutes × quantity` → 製作物の `estimatedWorkMinutes` に加算
- `requiresSiteInstallation` がtrue の場合のみ:
  - `hardware.installationMinutes × quantity` → 製作物の `estimatedSiteMinutes` に加算

これにより、**取付日に現場でどれだけ時間がかかるか**を算出可能。

---

## 3. Manufacturing Plugin（製造業向け）

### 3.1 機能一覧

| 機能 | 説明 | 優先度 |
|---|---|---|
| Manifest管理 | 成果物（Deliverable）のリスト管理 | 高 |
| 成果物→タスク連携 | 成果物追加で自動タスク生成 | 高 |
| 製作時間管理 | 成果物ごとの見積時間 | 高 |
| 現場時間管理 | 取付・施工などの現場作業時間 | 高 |
| 集計表示 | プロジェクト全体の合計時間・原価 | 高 |
| 原価管理 | 材料費・外注費（任意） | 中 |
| 予実管理 | 見積 vs 実績の比較 | 低 |

### 3.2 データ構造

```typescript
interface ManufacturingProject {
    itemId: string;           // JBWOS Core のプロジェクトID
    customerId?: string;      // Customer Plugin連携（任意）
    deliverables: Deliverable[];
}

interface Deliverable {
    id: string;
    projectId: string;        // 親プロジェクトID
    linkedItemId?: string;    // 自動生成されたJBWOSタスクへのリンク
    
    name: string;             // 成果物名（例: "リビングドア"）
    type: 'product' | 'service';  // 製作物 or 現場作業
    
    // 時間
    estimatedWorkMinutes: number;   // 製作時間（分）
    estimatedSiteMinutes: number;   // 現場時間（分）
    actualWorkMinutes?: number;     // 実績製作時間
    actualSiteMinutes?: number;     // 実績現場時間
    
    // 原価（任意）
    materialCost?: number;    // 材料費
    laborCost?: number;       // 労務費
    outsourceCost?: number;   // 外注費
    
    // ステータス
    status: 'pending' | 'in_progress' | 'completed';
    
    // プラグイン拡張用
    pluginData?: Record<string, unknown>;  // Tategu Plugin等が使用
}
```

### 3.3 JBWOS Coreとの連携

- プロジェクト画面に「成果物タブ」を追加
- 成果物を追加すると、対応するタスク（Item）がInboxに自動生成
- タスクの完了ステータスが成果物に反映

---

## 4. Tategu Plugin（建具向け）

### 4.1 機能一覧

| 機能 | 説明 | 優先度 |
|---|---|---|
| 建具パラメータ入力 | 框、パネル、ガラス、組子など | 高 |
| **姿図CAD（単体動作可）** | 建具図面の描画。試用・デモ用に単体でも動作 | 高 |
| 木材体積計算（姿図） | 姿図から材料量を自動計算 | 中 |
| 木材体積計算（表形式） | 手動入力での材料量計算 | 中 |
| 建具原価計算 | 建具仕様から原価を自動算出 | 中 |
| 建具テンプレート | 現調・製作・塗装・取付の工程 | 低 |

### 4.2 データ構造

```typescript
// 名称: Tategu（建具=Doorなので、TateguDoorは重複）
interface Tategu {
    id: string;
    deliverableId?: string;   // Manufacturing Plugin の成果物ID（オプション）
    
    // 建具仕様
    width: number;            // 幅(mm)
    height: number;           // 高さ(mm)
    thickness: number;        // 厚み(mm)
    
    tateguType: 'sliding' | 'hinged' | 'folding';  // 引戸/開き戸/折れ戸
    
    // 框
    frame: {
        material: string;     // 材種
        width: number;        // 框幅
        type: 'standard' | 'decorative';
    };
    
    // パネル・ガラス
    panels: {
        type: 'wood' | 'glass' | 'kumiko';
        material?: string;
    }[];
    
    // 組子
    kumiko?: {
        pattern: string;
        density: 'sparse' | 'medium' | 'dense';
    };
    
    // 自動計算結果
    calculatedMaterialVolume?: number;  // 立米
    calculatedMaterialCost?: number;    // 材料費
}
```

### 4.3 姿図CADの単体動作

> **設計決定**: 姿図CADはManufacturing Pluginがなくても単体で動作する

- **試用・デモ用**: 建具の姿図だけ描いて見せられる
- **Manufacturing連携時**: 描いた姿図が Deliverable に紐付き、自動タスク生成される

### 4.4 Manufacturing Pluginとの連携（オプション）

- `Deliverable.pluginData` に `Tategu` データを格納
- 姿図から計算した材料費・製作時間を `Deliverable` に反映
- 建具成果物を追加すると、建具用のデフォルトタスク（現調・製作・塗装・取付）が自動生成

---

## 5. 実装ロードマップ

### Phase 1: Customer Plugin（2週間）
1. [ ] Customer データ型定義
2. [ ] Customer CRUD API（PHP）
3. [ ] 顧客一覧画面
4. [ ] 顧客登録・編集モーダル
5. [ ] プロジェクトへの顧客紐付け

### Phase 2: Manufacturing Plugin 基礎（3週間）
1. [ ] ManufacturingProject, Deliverable データ型定義
2. [ ] Deliverable CRUD API（PHP）
3. [ ] プロジェクト作成時に「製造業プロジェクト」選択可能に
4. [ ] プロジェクト画面に「成果物タブ」追加
5. [ ] 成果物追加UI
6. [ ] 成果物→タスク自動生成ロジック
7. [ ] 集計表示（合計時間・原価）

### Phase 3: Tategu Plugin（3週間）
1. [ ] Tategu データ型定義（TateguDoor → Tategu に変更）
2. [ ] 姿図CADの単体動作対応
3. [ ] 姿図からの材料量自動計算
4. [ ] 表形式での木材計算UI
5. [ ] Manufacturing Plugin連携（オプション）
6. [ ] 建具テンプレート（工程自動生成）

