# Youkan

## Agent-ソートロジック改修
### タスク
- [x] タスク1: TodayController の commits ソート順を「着手開始日が近い順」に変更
  - [x] 1-1. 既存テスト・コードの理解
  - [x] 1-2. TodayControllerのcommitsソート順テストを書く（RED）
  - [x] 1-3. 実装（GREEN）- PHP側usortでsort_order優先、未設定ならdue_date近い順
  - [x] 1-4. TypeScriptコンパイル確認
- [x] タスク2: Stream ViewにFocusタスクのドラッグ&ドロップ並べ替え追加
  - [x] 2-1. reorderFocus()のsort_order統一テストを書く（RED）
  - [x] 2-2. reorderFocus()をsort_orderに修正 + 個人タスク対応（GREEN）
  - [x] 2-3. SortableFocusQueueコンポーネントのテストを書く（RED）
  - [x] 2-4. SortableFocusQueueコンポーネントを実装（GREEN: 4テストパス）
  - [x] 2-5. DashboardScreenに統合（TypeScriptコンパイルOK, 回帰テスト13件パス）

## Agent-nullクラッシュ修正
### 根本原因
`@dnd-kit/sortable` の `SortableContext` 内部 useMemo で `'id' in item` チェックが行われるが、
`typeof null === 'object'` が true のため、null要素があると `'id' in null` で TypeError になる。

### タスク
- [x] 根本原因の調査（'id' in null の発生箇所特定）
  - dnd-kitのSortableContext内部: `typeof item === 'object' && 'id' in item`
  - items配列にnull/undefinedが混入 or id==nullのアイテムが含まれると発生
- [x] テスト作成（RED確認） - sanitizeItems: 8テスト
- [x] 修正実装（GREEN確認） - sanitizeItems関数 + 全箇所に防御フィルタ適用
- [x] ビルド確認 - tsc --noEmit OK, vite build OK

## Agent-SdDD仕様書整備 (2026-03-24)
### タスク
- [x] 既存ドキュメントの調査・読み込み（00_Vision/, spec/, SPEC/, User_Voices/）
- [x] 実際のコード構成の確認（package.json, db.php, App.tsx, コントローラ群）
- [x] docs/SPEC.md 作成（仕様書目次・全体概要）
- [x] docs/request_log.md 作成（リクエスト履歴テンプレート）
- [x] docs/spec/01_概要.md 作成（Youkanとは何か・ターゲット・課題・思想）
- [x] docs/spec/02_機能仕様.md 作成（全15機能の一覧と詳細）
- [x] docs/spec/03_画面設計.md 作成（4つのView Mode・共通コンポーネント・画面遷移）
- [x] docs/spec/04_データ設計.md 作成（DB設計・状態定義・API設計）
- [x] docs/spec/05_技術設計.md 作成（技術スタック・3層アーキテクチャ・ディレクトリ構造）
- [x] docs/spec/06_変更履歴.md 作成（SdDD導入記録）

## Agent-ドラッグ&ドロップ範囲改善 (2026-03-24)
### タスク
- [x] テスト作成（RED確認） - カード全体のドラッグ属性検証: 3テスト
- [x] 実装（GREEN確認） - attributes/listenersをカード全体のdivに移動
- [x] ビルド確認 - tsc --noEmit OK, vite build OK

## Agent-総会プロジェクトバグ調査 (2026-03-24)
### 調査結果
- [x] バックエンドのproject_id割り当てロジック調査（ItemController.php create/update）
- [x] フロントエンドのアイテム作成フロー調査（QuickInputWidget → throwIn → addItemToInbox）
- [x] プロジェクトフォーカスモードの設計意図確認（SPEC_ProjectFocused_Visibility.md）
- [x] 本番DBデータ確認（総会プロジェクトの紐づきアイテム6件、全て正当）
- [x] 調査報告書作成（docs/SPEC/investigation_soukai_bug.md）
- [x] requests.md 更新（調査結果に基づく要件具体化）

### 発見した問題（修正済み）
1. `BaseController.php:142` - projectTitle フォールバックロジック修正済み
2. `CloudYoukanRepository.ts:50-51` - GdbShelf API修正済み
3. データ不整合18件 → マイグレーション実行済み（19件更新）

### 次のアクション
- [x] ユーザーに具体的なUI画面でのバグ再現手順をヒアリング
- [x] 問題Aの修正: projectTitle フォールバックロジック修正
- [x] 問題Bのデータ修復: マイグレーションSQL実行
- [x] 問題Cの修正: GdbShelf API呼び出し修正

## Agent-総会プロジェクトバグ修正 (2026-03-24)
### タスク
- [x] 問題1: projectTitle フォールバックロジック修正
  - [x] 1-1. PHPテスト作成（backend/tests/test_project_title_fallback.php）
  - [x] 1-2. BaseController.php 修正 + 本番デプロイ
- [x] 問題2: データ不整合の修復（本番DBマイグレーション）
  - [x] 2-1. 影響範囲確認SELECT（18件、うち17件がis_project親）
  - [x] 2-2. マイグレーションSQL実行（19件更新、バックアップ: jbwos.sqlite.bak_20260324_soukai_fix）
- [x] 問題3: GdbShelf API でproject_id未送信
  - [x] 3-1. フロントエンドテスト作成（RED確認: 1テスト失敗）
  - [x] 3-2. CloudYoukanRepository.ts 修正（GREEN確認: 4テスト全パス）
- [x] ビルド確認（tsc --noEmit OK, vite build OK, 回帰テスト8/8パス）

## Agent-real_project_title JOIN不足修正 (2026-03-24)
### 根本原因
GdbController, TodayController, ItemController(aggregated/personal/company), CalendarController の
SQLクエリに `LEFT JOIN items proj ON items.project_id = proj.id` がなく、
`proj.title as real_project_title` が取得できていなかった。
BaseController.mapItemRow は `real_project_title` を参照するが、SQL結果に含まれないため
常にNULLとなり、プロジェクト所属アイテムでも `projectTitle` が空になっていた。

### タスク
- [x] 1. テスト作成（backend/tests/test_real_project_title_join.php）
- [x] 2. GdbController.php: 4つのSQL全てに proj JOIN追加
- [x] 3. TodayController.php: 3つのSQL全てに proj JOIN追加
- [x] 4. ItemController.php: aggregated(2箇所), personal, company の4つのSQLに proj JOIN追加
- [x] 5. CalendarController.php: getLoad, getItems の2つのSQLに proj JOIN追加 + カラム名にitems.プレフィックス追加
- [x] 6. ビルド確認（tsc --noEmit OK, vite build OK）

## Agent-右クリックメニュー統一 (2026-03-24)
### 要件
登録と集中画面（DashboardScreen）の右クリックメニューを全体一覧2（GlobalBoard）と同じメニュー項目にする。

### 差分
- GlobalBoard: 5項目（詳細/名前変更、プロジェクト化、今日やる、断る、完全削除）
- DashboardScreen: 2項目（詳細/名前変更、削除）- legacyモード使用

### タスク
- [x] 1. 共通アクション生成関数 `buildItemContextMenuActions` を作成
  - [x] 1-1. テスト作成（RED確認: モジュール未存在で失敗）
  - [x] 1-2. 実装（GREEN確認: 5テスト全パス）
- [x] 2. DashboardScreenのContextMenuをactionsモードに変更
- [x] 3. GlobalBoardも共通関数を使うようにリファクタ
- [x] 4. ビルド確認（tsc --noEmit OK, vite build OK, 回帰テスト6/6パス）
