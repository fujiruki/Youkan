# 調査報告書：「総会」プロジェクトのアイテム所属バグ

**調査日**: 2026-03-24
**報告者**: AI Agent
**ステータス**: 調査完了・修正方針提案

---

## 1. 調査サマリ

### 結論
本番DBにおいて、「総会」プロジェクト（ID: `019cff5e-9d2a-7f49-990e-2f3c2b2c9679`）に `project_id` で紐づくアイテムは **6件のみ** で、全て総会に関連する正当なサブタスクであった。**DB上のデータ異常は確認されなかった。**

ただし、以下の **設計上の問題3件** を発見した。これらの複合により、ユーザーが「意図していないアイテムがプロジェクトに所属している」と感じる状況が発生し得る。

---

## 2. 発見した設計上の問題

### 問題A: `projectTitle` のフォールバックロジック（影響度: 高）

**ファイル**: `backend/BaseController.php` 142行目

```php
$item['projectTitle'] = $item['real_project_title'] ?? $item['parent_title'] ?? null;
```

**内容**: `project_id` が NULL のアイテムでも、`parent_id` が設定されていれば親タスクのタイトルが `projectTitle` として返される。UIはこの値を使って「所属プロジェクト名」を表示するため、実際には `project_id` が NULL でも、親タスクの名前がプロジェクト名として表示される。

**本番データでの影響**: `parent_id` あり・`project_id` NULL のアクティブアイテムが **18件** 存在。これらは UI 上で親タスクの名前が「プロジェクト名」として表示されている。

**正しい挙動**: `projectTitle` は `real_project_title`（= `project_id` に基づく JOIN）のみを使用すべき。`parent_title` へのフォールバックは `parentTitle` 等の別フィールドで返すべき。

### 問題B: GdbShelf取得時に `project_id` がAPIに渡されない（影響度: 中）

**ファイル**: `JWCADTategu.Web/src/features/core/youkan/repositories/CloudYoukanRepository.ts` 50-51行目

```typescript
const resolvedScope = projectId ? 'aggregated' : (scope || 'dashboard');
const allItems = await ApiClient.getAllItems({ scope: resolvedScope });
```

**内容**: `getGdbShelf` でプロジェクトフォーカス時に、バックエンドの `GdbController`（プロジェクトフィルタ付き）ではなく、`ItemController` の `getAllItems` (`scope=aggregated`) が呼ばれる。`project_id` パラメータはAPIに全く渡されない。結果として **ユーザーの全アイテム** がフロントエンドに返される。

フロントエンドの `filterItems`（useYoukanViewModel.ts 88行目）でクライアントサイドフィルタが適用されるため表示上は概ね正しいが:
- 不必要に大量のデータが転送される
- `GdbController` のプロジェクトフォーカスロジック（OR結合）が使用されない

### 問題C: プロジェクトフォーカスモードでのアイテム作成時の暗黙的 `project_id` 付与（影響度: 高・設計意図の確認が必要）

**ファイル**: `JWCADTategu.Web/src/features/core/youkan/viewmodels/useYoukanViewModel.ts` 748-753行目

```typescript
const throwIn = async (title: string, tenantId?, targetProjectId?, initialStatus = 'inbox') => {
    const activeProjectId = targetProjectId !== undefined ? targetProjectId : projectId;
    // ...
```

**内容**: `throwIn` の第3引数 `targetProjectId` が `undefined`（= 呼び出し元が明示的に渡さなかった）場合、ViewModel のスコープ変数 `projectId`（= プロジェクトフォーカス中のプロジェクトID）にフォールバックする。

**QuickInputWidget** は `projectContext?.id || null` を渡すため、`projectContext` が null の場合は `null` が渡され、`null !== undefined` なので `activeProjectId = null` となる。**この経路では問題は発生しない。**

ただし、**他のアイテム作成経路**（例: importItem、createSubTask 等）で `throwIn` の第3引数を省略した場合、意図せずフォーカス中のプロジェクトIDが付与される可能性がある。

---

## 3. 本番データの確認結果

### 総会プロジェクトのアイテム（全6件）

| タイトル | status | 関連性 |
|:--|:--|:--|
| 案内をだす | inbox | 総会に直接関連 |
| あか月に連絡 | done | 総会に直接関連 |
| サブに連絡 | focus | 総会に直接関連 |
| 昨年の総会いくらでお願いしたか調べる | inbox | 総会に直接関連 |
| 来年の予算をどうするか考える | inbox | 総会に直接関連 |
| 来年の大会にかかるお金を調べる | inbox | 総会に直接関連 |

全てのアイテムは `parent_id` も `project_id` も総会プロジェクトを指しており、内容も総会に関係するものばかり。**DB上のデータ汚染は確認されなかった。**

### 全体統計

| 指標 | 値 |
|:--|:--|
| アクティブアイテム総数 | 328件 |
| `project_id` がセットされているアイテム | 120件 |
| `parent_id` あり・`project_id` NULL のアイテム | 18件 |
| プロジェクト数（`project_id` のユニーク数） | 36プロジェクト |

---

## 4. 仮説の検証結果

| 仮説 | 結果 |
|:--|:--|
| プロジェクトフォーカスモード中のアイテム作成で自動的にproject_idが付与される | QuickInputWidget経由では発生しない（`null` が明示的に渡される）。ただし他の経路では理論的に発生し得る（問題C） |
| 意図せず総会をフォーカスしたまま他のアイテムを作成すると全て総会に紐づく | QuickInputWidget経由では発生しない。DBにもそのような形跡なし |
| `projectTitle` のフォールバックにより、実際にはproject_id NULLのアイテムがプロジェクト所属に見える | **18件のアイテムで発生している**（問題A）。ただし「総会」名の親タスクを持つものは0件 |

---

## 5. 修正方針

### 方針A: `projectTitle` フォールバックの修正（推奨・最優先）

`BaseController.php` 142行目を修正し、`projectTitle` は `project_id` JOIN の結果のみを使用する。`parent_title` は別フィールド `parentTitle` として返す。

```php
// 修正前
$item['projectTitle'] = $item['real_project_title'] ?? $item['parent_title'] ?? null;

// 修正後
$item['projectTitle'] = $item['real_project_title'] ?? null;
$item['parentTitle'] = $item['parent_title'] ?? null;
```

フロントエンドで `parentTitle` を表示する箇所を適切に更新する。

**影響範囲**: `backend/BaseController.php`、フロントの Item 表示コンポーネント全般

### 方針B: `parent_id` あり・`project_id` NULL のデータ整合性修復

18件の不整合データに対して、`parent_id` の親が `is_project = 1` の場合、`project_id` を自動で設定するマイグレーションスクリプトを実行する。

```sql
UPDATE items SET project_id = parent_id
WHERE project_id IS NULL
AND parent_id IS NOT NULL
AND parent_id IN (SELECT id FROM items WHERE is_project = 1);
```

**注意**: この修正は `create()` メソッドの `$data['projectId'] ?? null`（654行目）が原因で、古いフロントエンドバージョンから作成されたサブタスクで `projectId` が渡されなかったことが原因と推測される。

### 方針C: GdbShelf の API 呼び出し修正（中優先）

`CloudYoukanRepository.ts` の `getGdbShelf` で、プロジェクトフォーカス時に `GdbController` の API を呼び出すか、少なくとも `project_id` パラメータを渡すように修正する。

---

## 6. 追加調査が必要な項目

- ユーザー（晴樹）に、「総会プロジェクトに所属しているアイテムが多数ある」と感じた具体的なUI画面・操作手順をヒアリングする必要がある
- 本調査ではDB上のデータ異常は確認されなかったため、表示上の問題（問題A）が原因の可能性が高いが、別の画面で異なるバグが発生している可能性も排除できない
