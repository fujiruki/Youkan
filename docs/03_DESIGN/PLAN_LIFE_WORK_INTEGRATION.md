# Life-Work Integration & Status Model 実装設計書

## 1. 概要 (Overview)
`ARCHITECTURE_LIFE_WORK.md` および `STATUS_MODEL_HARUKI.md` に基づき、**「個人を中心とした統合ビュー」**と**「厳格なステータス管理」**を実現するための技術設計および移行計画です。

## 2. 現状の課題 (Current Issues)
1.  **シングルテナントの壁**: 現在のバックエンド (`ItemController`) は、ログイン中のトークンに含まれる `currentTenantId` のデータしか返さない。これにより、「個人のタスク」と「会社のタスク」を同時に見ることができない。
2.  **ステータスの揺れ**: `active`, `preparation`, `decision_hold` など、古いステータス定義が混在しており、Haruki Modelの「5つのステータス」と一致していない。
3.  **コンテキストの不在**: UI上に「仕事モード」「プライベートモード」を切り替える仕組みがない。

---

## 3. 技術的解決アプローチ (Technical Approach)

### A. バックエンド: クロステナント・アグリゲーション (Cross-Tenant Aggregation)

「ログインし直さずに、全ての箱のデータを見る」を実現するため、APIを拡張します。

#### 変更点: `ItemController.php`
現在の `WHERE tenant_id = ?` という単純なクエリを改修し、**「ユーザーが所属する全てのテナント」**を行横断的に検索可能にします。

**Logic:**
1.  `AuthController` はログイン時、トークン内に `joined_tenants: ['t_personal', 't_company']` のようなリスト（またはハッシュ）を含める。
    *   *Option*: トークンサイズを抑えるため、API側で毎回 `memberships` テーブルを引く方が安全かつ確実。
2.  `ItemController::getMyItems()` を拡張。
    *   `include_joined=true` パラメータがある場合、`currentTenantId` だけでなく、`memberships` テーブルで紐付いている全テナントのアイテムを取得する。
    *   取得したアイテムには、判別用の `tenant_id` や `tenant_name` を付加して返す。

```sql
-- 概念SQL
SELECT items.*, tenants.name as tenant_name
FROM items
JOIN tenants ON items.tenant_id = tenants.id
JOIN memberships ON items.tenant_id = memberships.tenant_id
WHERE memberships.user_id = :current_user_id
  AND (
      items.tenant_id = :current_tenant_id -- デフォルト
      OR :include_joined = 1               -- オプションで全取得
  )
```

### B. フロントエンド: コンテキスト管理 (Context Management)

`JBWOSRepository` と `useJBWOSViewModel` を拡張し、取得した混合データをUI側でフィルタリングします。

1.  **Store**: `uiStatus.context` を追加 (`ALL` | `WORK` | `LIFE`)。
2.  **Filter Logic**:
    *   `ALL`: 全アイテムを表示。
    *   `WORK`: `tenant_id === business_tenant_id` のアイテムのみ表示。
    *   `LIFE`: `tenant_id === personal_tenant_id` のアイテムのみ表示。
3.  **Quick Add**:
    *   `ALL` モード時の新規作成は、ユーザー設定の「Default Tenant」を使用。
    *   `WORK` モード時は「Business Tenant」、`LIFE` モード時は「Personal Tenant」に作成。

### C. ステータスモデルの移行と厳格化 (Status Migration)

Haruki Modelの `inbox`, `waiting`, `ready`, `pending`, `done` の5つに統一します。

1.  **DB Migration (`migrate_haruki_status.php`)**:
    *   既存データを新ステータスに変換するスクリプトを作成・実行。
    *   ルール:
        *   `active` -> `ready`
        *   `decision_hold` -> `pending`
        *   `scheduled` -> `ready` (+ flags)
        *   `preparation` -> `waiting` (他者待ち) or `ready` (着手待ち) ※要判断ロジック
2.  **API Guard**:
    *   `ItemController` の `create`, `update` 時に、上記5つ以外の `status` が送られてきたらエラーにする（または強制変換する）。

---

## 4. 実装ステップ (Implementation Steps)

### Step 1: バックエンド基盤 (Tenant Agnostic API)
1.  `AuthController.php`: ログインレスポンス (`/auth/login`, `/auth/me`) に `memberships` (所属テナント一覧) を含めて返すように変更。
2.  `ItemController.php`: `getMyItems` メソッドを改修し、所属する全テナントのアイテムを取得可能にする。

### Step 2: フロントエンド基盤 (Repository & Types)
1.  `types.ts`: `Item` 型に `tenantId` (必須に近い扱い) を追加。`ItemFlags` (Haruki Model) の定義。
2.  `JBWOSRepository.ts`: APIから受け取ったマルチテナントデータを正しくマッピングする処理。
3.  `useAuth`: ログインユーザー情報に `joinedTenants` を保持させる。

### Step 3: ステータス移行 (Migration)
1.  PHPスクリプトで既存アイテムのStatusを一括変換。
2.  フロントエンドのConstants/Enumsを更新し、古いStatusを選択肢から消す。
3.  かんばんボード等のカラム定義を新Status (5カラム) に固定。

### Step 4: UI実装 (Context Switch)
1.  ヘッダーまたはサイドバーに `[ALL] [WORK] [LIFE]` スイッチを配置。
2.  各ビュー（Today, Inbox, Project）で、このスイッチに応じたフィルタリングを適用。

---

## 5. 確認事項 (Questions)

*   **Prep Dateの扱い**: 古い `preparation` ステータスは「準備中」を意味していましたが、Haruki Modelでは「準備」はStatusではなく、`ready` ステータスの中でのフェーズ（いつやるか）として扱いますか？
    *   *Assumption*: `ready` ステータスにしつつ、`prep_date` (着手日) を未来に設定することで、Todayには出ないが「着手待ち」として表現する（Future Filter）。
*   **キャパシティ計算**: 「仕事の8時間」＋「家事の2時間」の合算は、あくまで「Today画面」での表示上の計算ロジックとして実装します（DBには持ちません）。

まずはこの設計で合意形成を図り、Step 1 から実装を開始します。
