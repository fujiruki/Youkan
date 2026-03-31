# Plugin Integraton Architecture Design

ユーザーからの要望「テンプレートの編集」「建具データ・原価計算とのディープリンク」を実現するためのアーキテクチャ設計案です。

## 1. Plugin Template System (テンプレート機能)
プロジェクト作成時に展開される「初期タスク」を、ハードコードではなくプラグイン側で管理・編集可能にします。

### Data Structure
プラグイン設定 (`PluginSettings`) にテンプレート定義を持たせます。

```typescript
// Plugin Settings Schema (Concept)
interface TateguPluginSettings {
    projectTemplates: {
        id: string; // 'standard-renovation', 'new-construction'
        name: string; // "標準リフォーム", "新築工事"
        tasks: {
            title: string;
            category?: string; // 'survey', 'drawing', 'estimate'
            description?: string;
            relativeDueDays?: number; // プロジェクト開始日からの相対日数
        }[];
    }[];
}
```

### UI Flow
1.  **設定画面**: ユーザーは「建具プラグイン設定」画面で、このJSON（またはUIフォーム）を編集し、カスタムテンプレートを作成できる。
2.  **プロジェクト作成**: JBWOSの「+プロジェクト」画面で `建具プロジェクト` を選ぶと、さらに「テンプレート選択」のサブメニューが表示される（複数ある場合）。

---

## 2. Deep Data Linking (Bridge Pattern)
JBWOSのタスク (Item) と、建具プラグインのデータ (Door, Estimate) を双方向にリンクさせます。

### The "Reference" Field
`Item` 型に、外部データへの参照ポインタを持たせます。

```typescript
interface Item {
    // ... existing props
    
    // [NEW] External Reference
    reference?: {
        pluginId: 'tategu-core';
        type: 'door' | 'estimate' | 'room';
        id: string; // 建具データのID (例: "door-uuid-1234")
    };
}
```

### Use Cases (活用例)

#### A. 製作建具の姿図デザイン (Door Designer Link)
1.  **Scenario**: タスク「リビング入り口ドアの設計」を作成。
2.  **Action**: タスク詳細画面に「建具データを関連付ける」ボタンを表示。
3.  **Link**: 新規作成 or 既存の建具データを選択してリンク。
4.  **Result**:
    - タスク詳細に、リンクされた**建具のサムネイル（姿図）**が表示される。
    - 「デザイン画面を開く」ボタンで、建具エディタへ直接遷移。

#### B. 原価・見積連携 (Cost & Estimation)
1.  **Scenario**: 建具データ側で「材料費」「加工手間」を計算。
2.  **Sync**: 建具データの原価合計が変わると、リンクされているタスクの `estimatedCost` (新設) や `memo` に自動反映、または参照表示する。
    - 親プロジェクトの原価合計 = 子タスク（各建具）の原価合計として集計可能。

---

## 3. Implementation Roadmap
この設計を実現するためのステップです。

### Phase 1: Template Engine (今回)
- [ ] `PluginSettings` インターフェースの定義。
- [ ] モックデータとして「標準テンプレート」を実装。
- [ ] プロジェクト作成時にテンプレートを展開するロジック (`createProject`) の拡張。

### Phase 2: Deep Linking (次回以降)
- [ ] 建具データ (DoorData) のDB構造整備。
- [ ] Item に `reference` フィールドを追加。
- [ ] `DecisionDetailModal` にプラグイン用カスタムレンダラー枠（サムネイル表示用）を用意。

## 4. Workflow Re-evaluation: Deliverable-First Architecture (成果物中心設計)

ユーザーからのフィードバックに基づき、「タスクから作る」のではなく**「成果物(Deliverable)リストからタスクが生まれる」**フローへ設計を見直します。

### Concept
**"Manifest (拾い出し表)" as the Single Source of Truth.**

1.  **Entry Point**: ユーザーはプラグインの「設計・拾い出し画面 (Plugin Dashboard)」を操作する。
2.  **Action**: そこで「建具A」「建具B」「造作AA」「現場作業AAA」を登録する。
3.  **Generation**: システムがそれらに基づいて、JBWOS側のInboxにタスクを自動生成（または同期）する。

### Data Flow
```mermaid
graph LR
    User[User] -->|Adds| Manifest[Plugin Manifest<br>(List of A, B, AA...)]
    Manifest -->|Syncs| Items[JBWOS Items<br>(Task: Make A, Make B...)]
    
    subgraph Plugin Data
        DoorA[Data A<br>Install: 2h]
        DoorB[Data B<br>Install: 3h]
        WorkAAA[Work AAA<br>Time: 1h]
    end
    
    Manifest -.-> DoorA
    Manifest -.-> DoorB
    Manifest -.-> WorkAAA
    
    PluginView[Project View] -->|Aggregates| Total[Total On-site Time<br>(2h+3h+1h = 6h)]
```

### Revised UI Flow
1.  **Project View**: 「建具プロジェクト」を開くと、まずは「**構成一覧 (Manifest)**」タブが表示される。
2.  **Add Items**:
    *   「+ 建具を追加」 -> 建具エディタでAを作成。 -> **自動で「A製作」タスク生成**
    *   「+ 現場作業を追加」 -> 作業名と時間を入力。 -> **自動で「現場作業」タスク生成**
3.  **Aggregation**:
    *   構成一覧のフッターに「合計現場作業時間: 〇時間」「合計原価: 〇円」がリアルタイム表示される。
4.  **Task Management**:
    *   生成されたタスクは JBWOS (Global Board) にも流れてくるため、日々のスケジューリングはそちらで行う。
    *   タスク完了 -> 構成一覧側のステータスも「製作完了」になる。

この設計により、**「まずは物を決める」**という職人の自然な思考フローと、**「日々の作業を管理する」**タスク管理のメリットを両立させます。
