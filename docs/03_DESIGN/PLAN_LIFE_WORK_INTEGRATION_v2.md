# Life-Work Integration & Status Model 実装設計書 v2

## 1. 概要 (Overview)
「個人（Life）」と「仕事（Work）」をシームレスに統合しつつ、それぞれの視点（View）を適切に提供するための設計書です。
ユーザーフィードバックに基づき、モード切替などの複雑な操作を排除し、自然なビュー構成を採用します。

## 2. コア体験の定義 (Core UX)

### A. 前提思想
*   **Individual First**: ユーザーは常に「個人」として存在し、その中に「個人的な活動（Life）」と「仕事の活動（Work）」が含まれる。
*   **No Modes**: 「仕事モード」「生活モード」という明示的な切り替えは行わない。
*   **Personal Tenant**: 全てのユーザーは登録時に必ず**「個人用テナント (Personal Workspace)」**を持つ。これにより、所属会社がない状態（浮遊状態）をなくし、セキュリティリスクを排除する。

### B. 画面構成 (Views)
以下の3つの主要ビューを提供します。

#### 1. ダッシュボード (JBWOS Dashboard)
**「私のすべて」を見る場所。**
*   **対象データ**:
    *   自分の個人テナントの全タスク
    *   自分が所属する会社テナントのうち、**「自分にアサインされている (Assigned to Me)」** タスク
    *   自分が作成したタスク
*   **目的**: 今日の予定、インボックス、判断待ちを一箇所で処理する。
*   **Status**: Haruki Model (Inbox, Waiting, Ready, Pending, Done)

#### 2. プロジェクトリスト (Personal Projects)
**「私の企て」を見る場所。**
*   **対象データ**: 自分（個人テナント）のプロジェクトのみ。
*   **用途**: 引っ越し、旅行計画、趣味の製作など。

#### 3. 会社プロジェクトリスト (Company Projects)
**「組織の動き」を見る場所。**
*   **対象データ**: 所属する会社テナントの全プロジェクト（他人の担当分も含む）。
*   **用途**: 全体の進捗確認、チーム作業、案件管理。
*   **UI**: サイドバーに会社ごとのセクションを設ける（例: 「藤田建具店」セクション）。

---

## 3. 実装計画 (Implementation Plan)

### Phase 1: オンボーディングとセキュリティ改修 (The Fix)
**目的**: 「新規ユーザーに謎のタスクが表示される」バグの修正と、データ構造の正常化。

1.  **Backfill Personal Tenants**:
    *   テナントを持たない既存ユーザー（もし入れば）に対して、個人用テナントを作成・割り当て。
    *   `NULL` テナントIDを持つ既存Item（ゴミデータ）をクリーンアップまたは隔離。
2.  **Update Registration Logic (`AuthController.php`)**:
    *   登録時 (`/register`)、タイプに関わらず必ず「Personal Tenant (`{name}'s Life`)」を作成し、`owner` として紐付ける。
    *   「会社 (`proprietor`)」を選択した場合は、**追加で**「Company Tenant」を作成し紐付ける（2つのテナントに所属）。
3.  **Strict Item Security (`ItemController.php`)**:
    *   `getMyItems` などで `tenant_id` が `NULL` の検索を禁止。必ず `currentTenantId` (デフォルトはPersonal) を強制する。

### Phase 2: バックエンドの統合機能 (Aggregation)
**目的**: 複数のテナントに散らばる「自分に関連する全タスク」を一度に取得する。

1.  **Auth Token Update**:
    *   トークン (`/auth/login`) に `joined_tenants` リストを含めるか、バックエンドで `memberships` を参照するロジックを確立。
2.  **`ItemController::getMyItems` Extension**:
    *   新パラメータ `scope=aggregated` を導入。
    *   これ指定時、SQLを以下のように変更：
        ```sql
        SELECT items.*, t.name as tenant_name, t.id as source_tenant_id
        FROM items
        JOIN memberships m ON items.tenant_id = m.tenant_id
        JOIN tenants t ON t.id = items.tenant_id
        WHERE m.user_id = :me
        AND (
            items.tenant_id = :personal_tenant_id -- 個人のものは全部
            OR items.assigned_to = :me            -- 会社のものは自分担当のみ
            OR items.created_by = :me             -- 自分が作ったもの
            OR items.assigned_to IS NULL          -- (Option) 会社Inbox
        )
        ```

### Phase 3: フロントエンド改修 (UI Update)
**目的**: 新しいビュー構成の実装。

1.  **Side Navigation**:
    *   「Personal」セクション（Inbox, Today, Projects）
    *   「Companies」セクション（各会社ごとのProjectsへのリンク）
2.  **Dashboard Integration**:
    *   `JBWOSRepository.getGdbShelf` で `scope=aggregated` APIを使用。
    *   タスクカードに「🏢 会社名」や「🏠 個人」のようなバッジを表示（色分け推奨）。

---

## 4. データマイグレーション (Status & Data)
*   **Status**: Haruki Model (5 status) への統一スクリプト実行。
*   **Orphan Items**: `tenant_id` がないアイテムは、とりあえず管理者の個人テナントに寄せるか、削除する。

## 5. 専門家会議の結論
*   モード切替は UX を分断するため却下。
*   代わりにデータの「Aggregated View（統合）」と「Contextual View（会社別）」を使い分ける。
*   セキュリティ（他人のデータ漏洩）は最優先で修正。テナント分離を徹底する。
