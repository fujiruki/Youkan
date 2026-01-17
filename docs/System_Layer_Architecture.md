# System Layer Architecture: The Stacked Approach

ユーザー提案「一般向け部分、製造業向け部分、建具専門部分という積み上げ構造」に基づくアーキテクチャ定義です。
システムの汎用性と拡張性を担保するため、責務を明確に3層に分離します。

## 1. JBWOS Core (Platform Layer)
**汎用的なタスク管理・意思決定プラットフォーム**
あらゆる業種、個人の活動に適用可能なコア部分。今の `src/features/core/jbwos` がこれに該当。

*   **Capabilities**:
    *   **Decision Engine**: Inbox, GDB (Active/Standby/Someday), Today's Focus.
    *   **Task Management**: Todoリスト、期限管理、カレンダー連携。
    *   **Project Container**: タスクを束ねる箱としての「プロジェクト」。
*   **Target**: 全人類 (Personal Productivity)。

## 2. Manufacturing Layer (Extension Module)
**「モノづくり」に特化した共通機能レイヤー**
JBWOS Core の上に積み上げる、製造業・制作業向けの中間層。

*   **Capabilities**:
    *   **Manifest (拾い出し/構成表)**: 「タスク」の前段階にある「成果物(Deliverables)」を管理するリスト。
    *   **Attributes**: 製作時間(Man-hour)、原価(Cost)、現場作業(On-site Work)などの属性スキーマ。
    *   **Aggregation**: プロジェクト単位での「総製作時間」「原価合計」「現場工数」の集計ロジック。
    *   **Flow**: Manifest Item -> Task generation の同期システム。
*   **Target**: 建具屋、家具屋、鉄工所、ハンドメイド作家など。

## 3. Tategu Plugin (Domain Layer)
**建具業に特化した専門機能レイヤー**
Manufacturing Layer のインターフェースを実装した、最上位の具体化層。

*   **Capabilities**:
    *   **Door Data**: 縦框、横框、パネル、ガラスといった「建具特有のパラメータ」。
    *   **CAD/Design**: 姿図を描画するキャンバス機能。
    *   **Estimation Logic**: 建具の仕様から自動計算する「建具専用の原価計算ロジック」。
    *   **Custom Templates**: 「現調」「取付」など、建具工事特有の工程テンプレート。
*   **Target**: 建具専門店 (Tategu Design Studio)。

---

## Data Structure Example

```typescript
// 1. Core Item
interface Item {
    id: string;
    title: string; // "リビングドア製作"
    status: 'inbox' | 'today_commit' | ...;
    // ...
}

// 2. Manufacturing Extension (Linked via Bridge)
interface ManufacturingDeliverable {
    id: string;
    itemId: string; // Link to Core Item
    deliveryDate: string;
    cost: number;
    workTime: number; // 工場
    siteTime: number; // 現場
}

// 3. Tategu Domain Data (Extends Deliverable)
interface TateguDoor extends ManufacturingDeliverable {
    spec: {
        width: 800;
        height: 2000;
        kumiko: 'hon-kumiko';
        material: 'cedar';
    };
    // ...
}
```

## 4. Multi-Plugin Strategy (Expansion)
ユーザー要望「建具も家具も両方やる」に対応するための、マルチプラグイン戦略です。

### Concept: The "Manufacturing Bus"
Manufacturing Layer は、特定の業種に依存しない「共通のバス（受け皿）」として機能します。
1つのプロジェクトに対し、複数のプラグインが「納品物」をぶら下げることができます。

### Data Aggregation
プロジェクト (Core Item) は、Manufacturing Layer を通じて全てのプラグインのデータを集計します。

```mermaid
graph TD
    Project[Project: User House Renovation]
    
    subgraph Manufacturing Layer [Aggregation Bus]
        TotalCost[Total Cost: ¥1,500,000]
        TotalTime[Total On-site: 12h]
    end
    
    subgraph Tategu Plugin
        DoorA[Door A (Cost: ¥50k, Time: 2h)]
        DoorB[Door B (Cost: ¥50k, Time: 2h)]
    end
    
    subgraph Furniture Plugin
        ShelfA[Shelf A (Cost: ¥100k, Time: 4h)]
        CabinetB[Cabinet B (Cost: ¥200k, Time: 4h)]
    end
    
    Project --> Manufacturing Layer
    Manufacturing Layer --> Tategu Plugin
    Manufacturing Layer --> Furniture Plugin
```

### Benefits
*   **Unified View**: ユーザーは「建具」と「家具」を区別することなく、プロジェクト全体の原価や工数を把握できます。
*   **Flexibility**: 将来的に「リペア作業プラグイン」や「外注管理プラグイン」を追加しても、集計ロジックを変更せずに済みます。

