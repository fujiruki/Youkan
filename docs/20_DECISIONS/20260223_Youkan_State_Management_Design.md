# 意思決定ログ：Youkan における状態管理と立場ラベルの設計

## 背景
Youkan（旧称: JBWOS）は、個人タスクと複数会社のタスクが混在するハイブリッドな環境です。ユーザー（晴樹）が「今、どの立場で、何に集中すべきか」を迷わずに判断できるよう、UIと内部状態の整合性を厳密に定義しました。

## 状態遷移マトリックス

| ID | パターン | アカウント | モード | フィルタ | フォーカス | 立場ラベル | データ取得 (Scope) | フィルタリングロジック |
| :-- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **①** | **個人・統合** | ユーザー | 個人 | 全て (all) | なし | 自分の時間管理 | aggregated | 全表示 |
| **②** | **個人・専念** | ユーザー | 個人 | 個人 (personal) | なし | 自分の時間管理 | aggregated | `tenantId == null` |
| **③** | **会社横断** | ユーザー | 個人 | 会社 (company) | なし | 会社業務の俯瞰 | aggregated | `tenantId != null` |
| **④** | **特定社管理** | ユーザー | テナントA | (ID) | なし | 〇〇社マネージャー | tenant (A) | `tenantId == A` |
| **⑤**| **事業全体** | 会社 | 会社固定 | 事業 (all) | なし | 事業の管理 | aggregated/tenant | 会社の全プロジェクト表示 |
| **⑥** | **社内事務** | 会社 | 会社固定 | 社内 | なし | 社内事務の管理 | aggregated/tenant | `projectId == null` |
| **⑦** | **案件集中** | (任意) | (任意) | (任意) | **あり** | (案件名) | project (X) | `projectId == X` |

## 開発方針

### 1. 名称の「Youkan」統一
- 内部コード、localStorageキー、イベント名、UI上の表記から `jbwos` を廃止し、`youkan` にリプレイスする。

### 2. 状態同期の仕組み
- `JBWOSHeader` (View) と `useJBWOSViewModel` (Logic) は、`localStorage` と `CustomEvent ('youkan-filter-change')` を介して同期する。
- UIの色（Indigo=個人, Blue=会社）は、ユーザーの種別ではなく、**「現在アクティブなテナントが null かどうか」**で動的に判定する。

### 3. MECEな検証 (TDD)
- 上記マトリックスの各セルをテストケースとし、ユニットテスト (`vitest`) と結合テストで網羅する。

## 関連ファイル
- `JBWOSHeader.tsx` (今後 `YoukanHeader.tsx` へ検討)
- `ViewContextBar.tsx`
- `useJBWOSViewModel.ts`
- `CloudJBWOSRepository.ts`
