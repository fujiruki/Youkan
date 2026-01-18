# User Story: Tategu Project Workflow

## "Deliverables First" Workflow (成果物中心のワークフロー)

建具プロジェクトのリズムは、まず「何を作るか（成果物）」をリストアップすることから始まる。

### 1. プロジェクト開始と拾い出し (Manifesting)
ユーザーは建具プロジェクトを開き、現場に必要なものをリストアップしていく。

*   **制作物 (Deliverables)**: 工場で作るもの
    *   建具 A, B, C (2箇所), D...
    *   制作物 AA (建具以外の木工品など)
*   **現場作業 (On-site Services)**: 物は作らないが、現場で行う作業
    *   作業 AAA, BBB, CCC (採寸、調整、リペアなど)

### 2. タスクの発生 (Task Generation)
リストアップされた「制作物」から、自動的に制作タスクが生まれる。

*   「Aを作る」
*   「Bを作る」
*   「AAを作る」
*   (作業AAAなどは、それ自体がタスクとして扱われる)

### 3. データ属性と集計 (Attributes & Aggregation)
それぞれのアイテムには、以下の属性が登録される。

*   **制作物 (A, B...)**:
    *   制作時間（工場）
    *   材料原価
    *   **現場取付時間** (On-site Installation Time)
*   **現場作業 (AAA...)**:
    *   **現場作業時間** (On-site Work Time)

**プロジェクト全体としての表示**:
それぞれの「現場取付時間」と「現場作業時間」が合計され、**「総現場作業時間」** としてプロジェクトサマリーに表示されること。

---

### Insight for AI Design
*   **Entrance**: "Task creation" is NOT the primary entrance. "Product Listing" is.
*   **Relationship**: One Product (Deliverable) -> generates -> Task(s).
*   **Value**: The aggregate of time/cost from individual products is the primary value for project management.
