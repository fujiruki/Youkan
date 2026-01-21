# AI会議：製造業レイヤー詳細設計（Manufacturing Specs Refinement）

**日時**: 2026-01-22
**テーマ**: 製造業共通のタスクフローとデータ属性の再定義
**入力ソース**: ユーザー指摘（Step 884）
> ・製造業はプロジェクトが生まれると、「見積もり」タスクができる。そして製造物リストが増えるたびに、「それを製造するタスク」が存在することが確定する。
> ・製造業の製造物の共通属性として、製作時間、製造作業員労務単価（1時間あたり単価）、原材料費、現場作業時間、説明（長い文字列）、社内メモ（長い文字列）ガ必要。完成写真、実際の製作時間も入力したい。

**参加者**:
- **Facilitator**: ビジョンホルダー
- **Domain Expert (Manufacturing)**: 製造業業務フロー専門家
- **System Architect**: データモデル設計者

---

## 1. タスク発生フローの再定義

**Facilitator**: 
ユーザーから重要な業務フローの指摘がありました。プロジェクト開始時点からのタスク発生メカニズムを整理しましょう。

### 1-1. プロジェクト発生時：「見積タスク」の自動生成
> 「プロジェクトが生まれると、『見積もり』タスクができる」

**Domain Expert**:
これは製造業の一般的なフローです。
1.  **引合/依頼**: "プロジェクト"という箱ができる。
2.  **最初のタスク**: いきなり製造は始まりません。まずは「いくらかかるか？」を計算する**「見積 (Estimate)」**タスクが必ず発生します。
3.  **アクション**: 原価計算、図面確認、見積書作成、提出。

**System Architect**:
現状の「プロジェクト＝親タスク」だけでは不十分ということですね。
プロジェクト作成時に、そのプロジェクトに紐づく**最初の子タスクとして「見積作成」を自動生成**すべきです。

*   **Task Type**: `estimate`
*   **Title**: `見積作成｜{ProjectName}`
*   **Status**: `inbox`

### 1-2. 製造物追加時：「製造タスク」の確定
> 「製造物リストが増えるたびに、『それを製造するタスク』が存在することが確定する」

**Domain Expert**:
はい。`Deliverable`（製造物）= `Job`（仕事）です。
「ドアA」というデータを作った瞬間、それは「ドアAを作る」というタスクと同義になります。

**System Architect**:
これは前回の設計（3層構造）でカバーできていますが、より明確にします。
`Deliverable` レコード自体が「製造タスク」として振る舞います。

---

## 2. データ属性の拡充 (Data Schema Refinement)

**Facilitator**:
`Deliverable`（製造物）に必要な属性の洗い出しをお願いします。ユーザー要望を網羅する必要があります。

**Domain Expert**:
以下の項目が**「すべての製造業」**に共通して必要です。

| 項目名 | 英語名 (Property) | 意味・用途 | 現在のDB |
| :--- | :--- | :--- | :--- |
| **製作見積時間** | `estimatedWorkMinutes` | 工場で作るのにかかる予測時間。 | ✅ (Added) |
| **労務単価** | `laborRate` | 作業員の1時間あたりのコスト。原価計算の基礎。 | ❌ |
| **原材料費** | `materialCost` | 木材、金物などの仕入れ値合計。 | ❌ (costはあるが内訳不明) |
| **現場作業時間** | `estimatedSiteMinutes` | 現場での取付・調整にかかる時間。製造とは別枠。 | ✅ (Added) |
| **説明** | `description` | 顧客向けの説明（見積書に載る）。 | ✅ |
| **社内メモ** | `note` (internalMemo) | 顧客には見せない製作の注意点や申し送り。 | ❌ |
| **完成写真** | `photos` | 納品・取付後の証拠写真。複数枚。 | ❌ (DoorPhotosはあるがDeliverableに紐づけ必要) |
| **実製作時間** | `actualWorkMinutes` | 実際にかかった時間。予実管理用。 | ❌ |

**System Architect**:
了解しました。`Deliverable` テーブルを拡張します。
特に `laborRate`（労務単価）は、プロジェクト単位の設定（`ProjectSettings`）からデフォルト値を引いてくる形が良いでしょうが、個別に上書き可能にしておきます。

```typescript
interface Deliverable {
    // ...existing
    
    // Cost Details
    laborRate: number;       // [NEW] 労務単価
    materialCost: number;    // [NEW] 原材料費
    otherCost: number;       // [NEW] 外注費・経費
    
    // Time Management
    estimatedWorkMinutes: number; // 製作見積
    estimatedSiteMinutes: number; // 現場見積
    actualWorkMinutes?: number;   // [NEW] 実績時間
    
    // Notes
    description?: string;    // 公開説明
    note?: string;           // [NEW] 社内メモ
    
    // Media
    photos?: string[];       // [NEW] Blob ID list or Data URLs
}
```

---

## 3. 実装への反映事項

### 3-1. DBスキーマ更新 (db.ts)
*   `Deliverable` インターフェースに上記フィールドを追加。
*   `projects` テーブルにも `defaultLaborRate` があると親切（今回はスコープ外・プラグイン設定で持つべきかも）。

### 3-2. 自動タスク生成ロジック
*   **プロジェクト作成時**: `jbwos/useCases/createProject.ts` のような場所で、Project作成直後に `Item` (タイプ: `estimate`) を1つ作成する。
*   **製造物作成時**: `useJoineryViewModel.ts` で `Deliverable` を作る際、初期値として必要な属性をセットする。

### 3-3. UI修正
*   **エディタ (Editor)**:
    *   「説明」に加え「社内メモ」入力欄を追加。
    *   「製作時間」の横に「実績時間」入力欄を追加（完了後入力用）。
    *   コスト欄の内訳（材料費、労務単価）を表示・編集可能にする。

---

## 4. 結論

この設計で「製造業向けタスク管理」としての解像度が劇的に上がりました。
「見積 -> 受注 -> 製造(複数) -> 納品」というフローがデータ構造として表現されます。

承認をいただければ、再度 `db.ts` の更新（フィールド追加）から再開します。
