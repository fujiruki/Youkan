# 専門家会議議事録：データ同期戦略の再定義

**日時**: 2026-01-20
**参加者**: プロジェクトマネージャー (PM)、アーキテクト (Arch)、リード開発者 (Dev)
**議題**: 建具データ（Door）とJBWOSタスク（Task）の同期における責務の所在について

## 1. 現状の課題とユーザーからの指摘
**PM**: ユーザーから「建具（Door）の同期は、一般的な`EditorScreen`の実装というよりは、**製造業プラグイン側の責務**ではないか？」という鋭い指摘をいただきました。当初の計画では `useDoorViewModel` や `EditorScreen` で直接リポジトリを叩こうとしていましたが、これではプラグイン間の境界が曖昧になります。

**Arch**: その通りですね。`Door` は「建具プラグイン」のドメインですが、そこから生成される「製作タスク」は「業務（Manufacturing）プラグイン」の管轄です。建具エディタが直接 JBWOS のタスクを知りすぎるのは結合度が高すぎます。

## 2. アーキテクチャの再考
**Dev**: 現状、`StockIntegrationService.ts` が存在し、これが「成果物（Deliverable/Door）」から「ストック/タスク」への変換を担っています。しかし、これは「作成（Create）」のみで、「更新（Update）」のロジックがありません。

**Arch**: 正しいフローは以下のようになるべきです。

1.  **建具データ変更イベント**: 建具エディタで保存が行われる。
2.  **イベント発火/フック**: 建具プラグインは「データが更新された」という事実のみを通知、あるいは処理する。
3.  **製造業プラグインの介入**:
    *   製造業プラグイン（Manufacturing Plugin）が、更新された建具データに関連する「製作タスク」を特定する。
    *   必要であればタスクのタイトル（名前変更の反映）や、工数（見積もり変更の反映）を更新する。

**Dev**: 具体的には、`EditorScreen` で保存時に `StockIntegrationService.syncDoorToTask(door)` のようなメソッドを呼ぶ形でしょうか？ それとも、より疎結合にイベントバスを使いますか？

**Arch**: 現状の規模ならイベントバスは大げさかもしれません。しかし、`EditorScreen` が `JBWOSRepository` を直接叩いてタスクを更新するのは避けるべきです。
**提案**: `StockIntegrationService` を拡張し、**`syncDeliverableChanges(door: Door)`** というメソッドを実装します。`EditorScreen`（または `useDoorViewModel` の保存処理）は、このサービスメソッドを呼び出すだけに留めます。「タスクの更新」という詳細はサービス内に隠蔽します。

## 3. 実装詳細
**Dev**: `StockIntegrationService` 内でやることは以下の通りですね。
1.  **関連タスクの検索**: `door.id` をキーにして、既に作成済みのタスク（Stock）を探す。現状、タスク側に `doorId` をまだ持たせていませんでしたっけ？
    *   *確認*: `Item` 型には `relatedId` や `doorId` がありますが、`StockIntegrationService` で作成したタスクには `memo` にしか情報がない可能性があります。
    *   *修正*: タスク作成時（`createProject` や `syncStockFromDeliverable`）に、明確に `doorId` (または `sourceId`) を `Item` プロパティとして保存する必要があります。

2.  **更新の適用**:
    *   名前が変わっていたらタスク名を更新。
    *   工数が変わっていたら `estimatedMinutes` を更新。

**PM**: そうですね。タスクの `doorId` プロパティへの保存と、それを使った検索・更新。これが正しい道筋です。

## 4. 決定事項
1.  **責務の移動**: 同期ロジックは `useDoorViewModel` ではなく、**`StockIntegrationService`** (Manufacturing Plugin) に集約する。
2.  **データモデルの確認**: JBWOSの `Item` に `doorId` (または汎用的な `sourceId`) が正しく保存されることを保証する。
3.  **結合点**: `EditorScreen` の保存時に `StockIntegrationService` を呼び出す形は許容する（現状の依存関係上、Plugin -> Core/Other Plugin の呼び出しはやむを得ない）。

**PM**: これでユーザーの指摘通り、製造業プラグイン側の責務として実装できます。Implementation Planを更新しましょう。
