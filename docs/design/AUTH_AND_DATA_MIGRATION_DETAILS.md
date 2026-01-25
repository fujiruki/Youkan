# Life-Work Integration 詳細移行計画書 (Technical Design Document)

## 0. 現状分析と課題 (Analysis)

### 0-1. スキーマ定義の不整合
`backend/db.php` 内の `initDB` 関数において、`items` テーブルの定義に `tenant_id` カラムが含まれていません。
これにより、新規インストール環境やテスト環境のリセット後に `tenant_id` が欠落した状態でテーブルが作成され、後続のマイグレーションが適用されない場合、SQLエラーやデータの孤立（`tenant_id IS NULL`）が発生しています。

### 0-2. テナントデータの分離不全
`ItemController` は `WHERE tenant_id = ?` で検索しますが、`currentTenantId` が `NULL` (Auth Vulnerable) の場合、`tenant_id IS NULL` のデータ（＝どの組織にも属さないゴミデータ）を返却してしまっています。
これが「新規ユーザーに謎のタスクが見える」原因の最有力候補です。

## 1. データベース移行計画 (Database Migration Plan)

### Step 1: `db.php` の修正 (Correct Schema Definition)
`initDB` 関数内の `CREATE TABLE items` および `CREATE TABLE projects` の定義を最新化します。
特に `tenant_id TEXT NOT NULL` を追加し、外部キー制約も考慮します。

### Step 2: Personal Tenant Backfill Script (`migrate_v13_personal_tenants.php`)
既存ユーザーに対し、個人用テナントがない場合のみ新規作成し、紐付けるスクリプトを作成・実行します。

**Logic:**
1.  全ユーザー (`users` テーブル)をループ。
2.  `memberships` を確認し、`role = 'owner'` かつ `tenant.name = {user.name}'s Life` のような個人テナントがあるか確認。
3.  なければ作成 (`tenants` INSERT) し、紐付け (`memberships` INSERT)。

### Step 3: Orphan Data Cleanup (`migrate_v14_cleanup_orphans.php`)
`items`, `projects` テーブルにおいて、`tenant_id` が `NULL` または存在しないテナントIDを指しているレコードを処理します。

**Logic:**
1.  `tenant_id IS NULL` のレコードを抽出。
2.  `created_by` ユーザーの「Personal Tenant ID」に `UPDATE`。
3.  作成者が不明な場合は、管理者テナント (`t_default`) に寄せるか削除。

---

## 2. 認証ロジックの改修 (Authentication Update)

### **`backend/AuthController.php`**
ログインレスポンスのトークン構造を変更し、マルチテナントコンテキストを含めます。

**Payload Changes (`JWTService`):**
```php
$payload = [
    'sub' => $userId,
    'tn' => $personalTenantId, // System decides "Home Tenant"
    'scope' => 'app',
    'joined_tenants' => ['t_personal', 't_company_a'] // Option: Include list?
];
```
※ トークン肥大化を避けるため、トークンには `Primary Tenant ID` (Personal) のみを含め、他の所属テナントはサーバーサイドで毎回 `memberships` テーブルから解決する方式を採用します。

### **`backend/BaseController.php`**
`authenticate()` メソッドを以下のように拡張します。

```php
protected $joinedTenants = []; // List of authorized tenant IDs

protected function authenticate() {
    // ... (Existing Token Check) ...
    $this->currentUserId = $payload['sub'];
    
    // Fetch all memberships
    $stmt = $this->pdo->prepare("SELECT tenant_id FROM memberships WHERE user_id = ?");
    $stmt->execute([$this->currentUserId]);
    $this->joinedTenants = $stmt->fetchAll(PDO::FETCH_COLUMN);

    // Default currentTenantId to payload's tenant_id, but validate against joinedTenants
    // If request has header X-Tenant-ID, use that (Context Switch), prioritizing joinedTenants check.
}
```

---

## 3. バックエンドAPI改修 (API Update)

### **`backend/ItemController.php` (Aggregation)**

`getMyItems()` メソッドを、`joinedTenants` を活用するように書き換えます。

**New Logic:**
```php
private function getMyItems() {
    // Parameter: ?scope=aggregated (Life-Work Integration)
    $isAggregated = ($_GET['scope'] ?? '') === 'aggregated';

    if ($isAggregated) {
        $placeholders = implode(',', array_fill(0, count($this->joinedTenants), '?'));
        $sql = "
            SELECT items.*, t.name as tenant_name
            FROM items
            LEFT JOIN tenants t ON items.tenant_id = t.id
            WHERE items.tenant_id IN ($placeholders)
            AND (
                -- Personal Tenant's items: ALL visible
                (items.tenant_id = ?)
                OR 
                -- Company Tenant's items: Only Assigned or Created by Me
                (items.tenant_id != ? AND (items.assigned_to = ? OR items.created_by = ?))
            )
            ORDER BY items.updated_at DESC
        ";
        // Execute with proper mapping...
    } else {
        // Legacy (Single Tenant Mode)
        // ...
    }
}
```

---

### **`backend/ProjectController.php` (Aggregation)**

`index()` メソッドも同様に `scope=aggregated` に対応させます。
プロジェクトリスト画面で「会社」と「個人」を同時に表示するために必須です。

```php
private function index() {
    $isAggregated = ($_GET['scope'] ?? '') === 'aggregated';
    
    if ($isAggregated) {
         // Logic similar to getMyItems but for projects
         // Fetch projects from joined tenants AND personal tenant
    }
    // ...
}
```

---

## 4. フロントエンド改修 (Frontend Update)

### **Type Definitions (`types.ts`)**
*   `Item` インターフェースに `tenantId`, `tenantName` を追加。
*   `User` インターフェースに `personalTenantId` を追加。

### **Repository (`JBWOSRepository.ts` / `ProjectListScreen.tsx`)**
*   `getGdbShelf` で `ApiClient.getAllItems({ scope: 'aggregated' })` を呼ぶように変更。
*   **`ProjectListScreen.tsx` の改修**:
    *   現在 `!p.tenant_id` で個人プロジェクトを判定している箇所を修正。
    *   `Authentication` から「自分のPersonal Tenant ID」を取得し、`p.tenant_id === myPersonalTenantId` で判定するように変更。


---

---

## 4. フロントエンド改修 (Frontend Update)

### **Type Definitions (`types.ts`)**
*   `Item` インターフェースに `tenantId`, `tenantName` を追加。
*   `User` インターフェースに `personalTenantId` を追加。

### **Repository (`JBWOSRepository.ts` / `ProjectListScreen.tsx`)**
*   `getGdbShelf` で `ApiClient.getAllItems({ scope: 'aggregated' })` を呼ぶように変更。
*   **`ProjectListScreen.tsx` の改修**:
    *   現在 `!p.tenant_id` で個人プロジェクトを判定している箇所を修正。
    *   `Authentication` から「自分のPersonal Tenant ID」を取得し、`p.tenant_id === myPersonalTenantId` で判定するように変更。

---

## 5. セキュリティとプライバシー (Privacy Model)

本設計の核となる「Personal Tenant」方式により、以下のプライバシー保護を物理的に保証します。

1.  **テナント分離による遮断**:
    *   「個人のタスク」は `Personal Tenant (ID: t_personal_A)` に保存される。
    *   「会社のタスク」は `Company Tenant (ID: t_company_X)` に保存される。
2.  **アクセス権の独立**:
    *   自分（User A）は、両方のテナントのMembershipを持つため両方見える。
    *   同僚や上司（User B）は、`t_company_X` のMembershipしか持っていない。
    *   したがって、User B がどんなAPIを叩いても、データベースレベルで `t_personal_A` のデータにはアクセスできない（SQLで検索対象に入らない）。
3.  **管理者権限の限界**:
    *   会社の「Admin」権限であっても、及ぶ範囲は `t_company_X` の中に限定される。個人のテナントは「別会社」扱いであり、干渉できない。

---

## 6. 移行手順 (Execution Steps)

1.  **Backup**: 現在のDB (`jbwos.sqlite`) を完全にバックアップ。
2.  **Fix Schema**: `db.php` を手動修正。
3.  **Deploy Migrations**: `migrate_v13` (Personal Tenant), `migrate_v14` (Orphans) を配置し実行。
4.  **Confirm**: ユーザー登録フローをテストし、`tenant_id` が適切に設定されることを確認。
5.  **Code Update**: Backend API -> Frontend UI の順で実装適用。

この設計に基づき、開発を開始します。
