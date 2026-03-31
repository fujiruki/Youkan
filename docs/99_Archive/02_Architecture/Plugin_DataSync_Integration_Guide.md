# プラグイン開発者向けガイド: データ同期機能の利用

## 概要
このガイドでは、JBWOS製造業プラグインが提供する**データ同期機能（Data Sync）**を利用して、独自のプラグインを開発する方法を説明します。

この機能により、あなたのプラグインで管理するデータ（製品、サービス、作品など）を編集したとき、自動的にJBWOSタスクが更新されます。

### できること
- **名前の自動同期**: データ名を変更すると、タスク名も自動更新
- **見積時間の自動反映**: 作業時間の見積もりを変更すると、タスクの所要時間も自動更新
- **オートセーブ対応**: 保存ボタンを押さなくても、編集中に自動同期

---

## アーキテクチャ概要

```mermaid
graph TB
    subgraph YourPlugin [あなたのプラグイン]
        Editor[編集画面]
        Data[データモデル]
    end
    
    subgraph Manufacturing [製造業プラグイン (土台)]
        Deliverable[Deliverable型]
        Sync[syncDeliverableChanges]
    end
    
    subgraph JBWOS [JBWOS Core]
        Repository[JBWOSRepository]
        Tasks[タスク一覧]
    end
    
    Editor -->|保存| Data
    Data -->|変換| Deliverable
    Deliverable --> Sync
    Sync --> Repository
    Repository --> Tasks
```

### 重要な型定義: `Deliverable`

製造業プラグインは、**Deliverable（成果物）** という共通インターフェースを定義しています。
あなたのプラグインは、自分のデータをこの型に変換するだけで、同期機能を利用できます。

```typescript
export interface Deliverable {
    id: string;                      // ユニークID
    projectId: string;               // 親プロジェクトID
    name: string;                    // 成果物名（例: "リビングドア"）
    type: 'product' | 'service';     // 製作物 or 現場作業
    
    // 時間（見積）
    estimatedWorkMinutes: number;    // 製作時間（分）
    estimatedSiteMinutes: number;    // 現場作業時間（分）
    
    // ステータス
    status: 'pending' | 'in_progress' | 'completed';
    
    // 現場取付フラグ
    requiresSiteInstallation: boolean;
    
    // プラグイン拡張用
    pluginId?: string;               // あなたのプラグインID
    pluginData?: Record<string, unknown>;
    
    // メタデータ
    memo?: string;
    createdAt: number;
    updatedAt: number;
}
```

---

## 実装ガイド

### Step 1: 同期サービスのインポート

```typescript
import { syncDeliverableChanges } from '../../manufacturing/StockIntegrationService';
import { Deliverable } from '../../manufacturing/types';
```

### Step 2: データモデルからDeliverableへの変換関数を作成

あなたのプラグイン固有のデータ型を `Deliverable` に変換する関数を作成します。

**例: 家具プラグインの場合**

```typescript
// あなたのプラグインのデータ型
interface FurnitureItem {
    id: number;
    projectId: number;
    itemName: string;
    woodType: 'oak' | 'pine' | 'cedar';
    finishType: 'paint' | 'stain' | 'natural';
    estimatedCraftingHours: number;  // 時間単位
    needsDelivery: boolean;
    estimatedDeliveryHours: number;
    createdAt: Date;
}

// Deliverableへの変換関数
function furnitureToDeliverable(
    furniture: FurnitureItem
): Deliverable {
    return {
        id: String(furniture.id),
        projectId: String(furniture.projectId),
        name: furniture.itemName,
        type: 'product',
        estimatedWorkMinutes: furniture.estimatedCraftingHours * 60,
        estimatedSiteMinutes: furniture.needsDelivery 
            ? furniture.estimatedDeliveryHours * 60 
            : 0,
        status: 'pending',
        requiresSiteInstallation: furniture.needsDelivery,
        pluginId: 'furniture-plugin',
        pluginData: {
            woodType: furniture.woodType,
            finishType: furniture.finishType
        },
        createdAt: furniture.createdAt.getTime(),
        updatedAt: Date.now()
    };
}
```

### Step 3: 保存・編集時に同期を呼び出す

エディタ画面の保存処理で、同期関数を呼び出します。

```typescript
const handleSave = async () => {
    // 1. 自分のDBに保存
    await db.furnitureItems.update(furniture.id, {
        ...furniture,
        updatedAt: new Date()
    });
    
    // 2. Deliverableに変換
    const deliverable = furnitureToDeliverable(furniture);
    
    // 3. 同期サービスを呼び出し
    try {
        await syncDeliverableChanges(
            deliverable,
            project.name  // プロジェクト名（タスクタイトルに使用）
        );
        console.log('[FurniturePlugin] Sync completed');
    } catch (e) {
        console.error('[FurniturePlugin] Sync failed:', e);
    }
};
```

### Step 4: オートセーブ対応（オプション）

リアルタイムで同期したい場合、`useEffect`を使用します。

```typescript
useEffect(() => {
    const timer = setTimeout(async () => {
        if (furniture.id) {
            await db.furnitureItems.update(furniture.id, furniture);
            
            // 自動同期
            try {
                await syncDeliverableChanges(
                    furnitureToDeliverable(furniture),
                    project.name
                );
            } catch (e) {
                console.error('Auto-sync failed:', e);
            }
        }
    }, 1000); // 1秒のデバウンス
    
    return () => clearTimeout(timer);
}, [furniture, project.name]);
```

---

## 同期の動作フロー

### 初回作成時（タスクが存在しない）
1. ユーザーが家具アイテムを作成・保存
2. `syncDeliverableChanges` を呼び出し
3. システムが自動的にJBWOSタスクを生成
   - 「○○プロジェクト: 学習机 製作」（製作タスク）
   - 「○○プロジェクト: 学習机 配送」（現場タスク、必要な場合のみ）

### 更新時（タスクが既に存在する）
1. ユーザーが家具の名前や見積時間を変更
2. `syncDeliverableChanges` を呼び出し
3. 既存タスクを検索（`doorId`でマッチング）
4. タスクのタイトルと見積時間を自動更新

---

## サンプルコード: 鉄工プラグイン

```typescript
// 鉄工製品のデータ型
interface MetalProduct {
    id: number;
    projectId: number;
    productName: string;
    metalType: 'steel' | 'aluminum' | 'stainless';
    weight: number; // kg
    cuttingMinutes: number;
    weldingMinutes: number;
    polishingMinutes: number;
    requiresInstallation: boolean;
    installationMinutes: number;
    createdAt: Date;
}

// 変換関数
function metalToDeliverable(metal: MetalProduct): Deliverable {
    const totalWorkMinutes = 
        metal.cuttingMinutes + 
        metal.weldingMinutes + 
        metal.polishingMinutes;
    
    return {
        id: String(metal.id),
        projectId: String(metal.projectId),
        name: metal.productName,
        type: 'product',
        estimatedWorkMinutes: totalWorkMinutes,
        estimatedSiteMinutes: metal.installationMinutes,
        status: 'pending',
        requiresSiteInstallation: metal.requiresInstallation,
        pluginId: 'metalwork-plugin',
        pluginData: {
            metalType: metal.metalType,
            weight: metal.weight
        },
        createdAt: metal.createdAt.getTime(),
        updatedAt: Date.now()
    };
}

// 保存処理
async function saveMetalProduct(metal: MetalProduct, projectName: string) {
    await db.metalProducts.update(metal.id, metal);
    
    await syncDeliverableChanges(
        metalToDeliverable(metal),
        projectName
    );
}
```

---

## ベストプラクティス

### 1. IDの管理
- `Deliverable.id` には、あなたのプラグインのデータIDを**文字列化**して渡してください
- これにより、後から更新時に同じタスクを見つけられます

### 2. エラーハンドリング
```typescript
try {
    await syncDeliverableChanges(deliverable, projectName);
} catch (e) {
    console.error('[YourPlugin] Sync failed:', e);
    // ユーザーに通知するか、リトライロジックを実装
}
```

### 3. デバッグログの活用
同期サービスは詳細なログを出力します。開発時はコンソールを確認してください。

```
[StockIntegration] Syncing Door ID: 123, Name: 学習机, Proj: 子供部屋改装
[StockIntegration] Found 2 related items.
[Sync] Updating Item abc123 { title: '子供部屋改装: 学習机 製作' }
[Sync] Update Success
```

### 4. タスク名の命名規則
タスク名は以下の形式で自動生成されます:
- 製作タスク: `{プロジェクト名}: {成果物名} 製作`
- 現場タスク: `{プロジェクト名}: {成果物名} 取付` ※建具の場合

他の業界では「取付」の代わりに自由に変更できます（将来対応予定）。

---

## トラブルシューティング

### Q: タスクが更新されない
**A**: 以下を確認してください:
- `Deliverable.id` が正しく設定されているか
- 初回作成時に `doorId` がJBWOSタスクに保存されているか
- コンソールログでエラーが出ていないか

### Q: タスクが重複して作成される
**A**: `Deliverable.id` の値が毎回変わっている可能性があります。データIDを一貫して使用してください。

### Q: 見積時間が0分で作成される
**A**: `estimatedWorkMinutes` と `estimatedSiteMinutes` が正しく計算されているか確認してください。

---

## まとめ
1. あなたのデータ型を `Deliverable` に変換する関数を作成
2. 保存時に `syncDeliverableChanges` を呼び出す
3. オートセーブにも対応可能

これだけで、JBWOS の強力なタスク管理機能と連携できます。

ご不明な点があれば、`StockIntegrationService.ts` のソースコードを参照してください。
