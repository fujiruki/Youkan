# Life-Work Integration Architecture (個人の人生を統合する)

## 思想: Individual First (個人中心設計)

**「まず一人の人間（生活者）がいて、その活動の一部として事業（商売）がある」** というモデルです。

```mermaid
graph TD
    Me[個人 (Subject: 藤田晴樹)]
    
    subgraph "Life Scope (Private)"
        LifeTasks[生活・家事・趣味]
    end
    
    subgraph "Work Scope (Business: 藤田建具店)"
        WorkTasks[プロジェクト・見積・製作]
    end
    
    Me --> LifeTasks
    Me --> WorkTasks
    
    JBWOS[JBWOS (統合ビュー)]
    LifeTasks --> JBWOS
    WorkTasks --> JBWOS
```

## 実現へのアプローチ

データ構造としては「混ぜる」と「分ける」を両立させるため、以下のような**「統合レイヤー (Aggregation Layer)」**を設けます。

### 1. データの持ち方 (Storage)
管理・セキュリティ・会計の都合上、データ自体は「箱」を分けます（Multi-Tenant）。

*   **Personal Tenant (Default)**: 個人の生活ログ、プライベートなタスク、日記。
*   **Business Tenant (藤田建具店)**: 仕事のプロジェクト、顧客データ、事業売上。

### 2. 見せ方 (Presentation: JBWOS)
JBWOS（ダッシュボード・カレンダー）は、**ログインしているユーザーがアクセス権を持つ全ての箱からデータを吸い上げ、重ね合わせて表示**します。

#### 統合モード (Mix Mode)
*   **カレンダー**: 仕事の納期と、子供の学校行事が同じカレンダー上に表示されます。
*   **キャパシティ**: 「仕事で8時間」＋「家事で2時間」＝「今日の負荷10時間」として計算され、オーバーフローを防ぎます。
*   **タスクGrab**: 会社という「箱」からタスクを「Grab（掴み取り）」して、自分の今日（Life）のスケジュールに組み込むイメージです。

#### フィルタリング (Filter Context)
画面上のスイッチで、視点を切り替えます。

*   `[ALL]` : 人生全体を見る（デフォルト）
*   `[WORK]` : 仕事に集中する（生活タスクを隠す）
*   `[LIFE]` : プライベートのみ見る

## アカウント構造

ログインは常に「個人 (藤田晴樹)」として行います。

1.  **Login**: `a@gmail.com` でログイン
2.  **Context Loading**: 全ての所属テナント（個人箱・会社箱）をロード
3.  **Dashboard**: 「藤田晴樹のすべて」を表示

これにより、「会社のアカウント」と「個人のアカウント」を行き来する必要はなく、**一つのアカウントの中に複数の顔（役割）が同居する**形を実現します。
