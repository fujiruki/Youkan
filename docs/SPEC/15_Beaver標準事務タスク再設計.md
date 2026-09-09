# 15. Beaver標準事務タスク再設計（全体一覧を実タスクのみに保つ）

- 要望: R-0162（`docs/requests_log.md`）
- 前提: R-0161（`docs/SPEC/14_Beaver標準事務タスク.md`）の実装済み機能に対する、実運用フィードバックに基づく再設計。14の不変条件・データ設計（`generated_task_links`）・status遷移の骨格・capacity計算（`BeaverCapacityService.php`）は原則継承する。本書は差分（表示層の変更＋見積完了タイミングの1点修正）を追加仕様化する
- Y1・Y2・14の不変条件は無変更。Y3（バッファ・仮配置・案件テンプレート拡張）には進まない

## 1. 背景・目的

R-0161で、Beaver案件の初回同期時に「見積」「請求」の標準タスクを自動生成し、capacity計算に含めるようにした。実運用の結果、全体一覧（`OverviewBoard`）に案件ごとの「見積」「請求」がすべて並び、今本当に関わっている仕事が見えにくくなった。

全体一覧は「システム内部に存在する全仕事量を見る画面」ではなく、「今、人間が注意を向ける必要がある実タスクを見る画面」である。capacity計算に必要な情報と、全体一覧に表示する情報は分離する。

## 2. 3つの仕事量の概念整理

| 概念 | 定義 | 全体一覧 | capacity |
|:--|:--|:--|:--|
| 実タスク | 今後実行が必要で、現在すでに実行対象になっているもの | 表示する | 算入する |
| 将来必要工数 | 条件が成立すれば発生するが、まだ今取り組む必要はないもの | 表示しない | 算入する |
| バッファ | 予定外の遅延・誤差に備える余白。将来必要工数とは別概念 | （対象外） | （対象外） |

本書はバッファの実装は行わない（Y3で別途、本書はその余地を塞がない）。実タスク・将来必要工数は、新しいデータモデルを作らず、既存の`items.status`（`todo`＝実タスク、`pending`＝将来必要工数）でそのまま表現する。

## 3. 調査で確定した事実

### 3.1 現行のstatus遷移ロジックは、ライフサイクル要求とほぼ一致していた

`BeaverSyncService.php`の`applyStandardTaskStatusTransition()`は、Beaver案件statusの変化に応じて見積・請求のstatusを単調前進で自動遷移させる。Beaver側の正式なstatusマスタ（別プロジェクト Beaver の参考資料 `C:\Fujiruki\Projects\Beaver\docs\spec\R-0085_project_status_master.md`）は `問い合わせ/見積済/受注済/進行中/納品済/請求済/完了/キャンセル` の8値で、`BeaverSyncService.php`の定数もこれに対応している。

- `INVOICE_ACTIVATE_STATUSES = ['納品済','完了']`：請求は納品済まで`pending`（将来必要工数）、納品済で`todo`（実タスク）へ活性化——要望書の請求ライフサイクル案と一致
- `INVOICED_STATUS = '請求済'`：請求済で`done`——一致
- `CANCELLED_STATUS = 'キャンセル'`：見積・請求とも未完了なら`cancelled`——一致

唯一のズレ: 見積の完了（`done`）条件が旧仕様では`ESTIMATE_DONE_STATUSES = ['受注済','進行中','納品済','完了','請求済']`で、「受注済」から。要望原文は「見積提出済み等、実行完了したら…消える」であり、Beaverには実在する`見積済`ステータスの方が対応する。**本書で`見積済`から即`done`化するよう変更する（§4.3）**。

### 3.2 二重計上は現行実装で構造的に発生しない

`pending→todo`の遷移は同一item行の`status`列をUPDATEするだけで、新規item生成も工数の加算も発生しない。`BeaverCapacityService::isExcludedLeafItem()`は`pending`を除外条件に含まないため、`pending`のitemも生成時から一貫して`effective_total`に1回だけ算入され続ける。「pending 30分＋実タスク30分＝60分」という要望書が懸念する遷移バグは、現行実装では原理的に起こり得ない（無変更のまま維持する）。

`done`になったitemも`effective_total`にはそのまま残り続けるが（`computeNode()`は`status`を問わず`estimated_minutes`を`effective_total`へ算入する）、`completed`として別集計され、capacity-checkの`required_minutes`（`= max(baseline, children_sum) − completed`、`docs/SPEC/R-153_capacity_check_api_contract.md` §5）からは差し引かれる。これは通常のタスクと同じ既存のY1挙動であり、本書で変更しない。

### 3.3 全体一覧が請求を表示してしまう直接原因は表示層のみ

- `JWCADTategu.Web/src/features/core/youkan/repositories/CloudYoukanRepository.ts` `getGdbShelf()`: `intent: allItems.filter(i => isPending(i.status))`（`status==='pending'`のitem全部）
- `JWCADTategu.Web/src/features/core/youkan/components/OverviewBoard/useOverviewItems.ts` L65-75: `allItemsRaw`が`gdbIntent`を無条件に集約対象へ含めている

Todayでは`status IN ('today_commit','focus')`等の限定statusしか対象にしないため`pending`は自然に除外されるが、全体一覧はTodayと別画面・別ロジックであり、この除外を継承していなかった。

### 3.4 `pending`は既存の「要判断キュー」機能にも使われている

`docs/SPEC/04_データ設計.md` §4.6（R-125）: `pending`は「条件・時期待ち、またはやるかどうか自体を今は決めない判断保留」を表す既存の正式なstatusで、状況把握のPendingバケット・登録と集中のPendingセクション・全体一覧の「要判断」フィルタ/バッジ（R-127 ReviewSweep）に使われている。**`pending`全般を全体一覧から除外すると、この既存機能を壊す**。

→ 除外対象は「Beaver標準タスクの請求（`generated_task_links`の`task_role='invoice'`）」に限定する。既存のPendingバケット・要判断キュー・ReviewSweepの挙動・対象アイテムは変更しない。

### 3.5 capacity-checkは「仮受注シミュレーション」を持たない設計であり、それでよい

`docs/SPEC/R-153_capacity_check_api_contract.md`（Y1で確定・現在も正本）:
- 呼び出しのたびBeaver側を再取得し`upsertProject()`で実同期する（§4.1-2）。判定結果自体は保存しないが、案件・リンク・標準タスクの生成は実際に行われる（読み取り専用なのは「Youkanのスケジュールを書き換えない」の意味であり、「同期しない」の意味ではない）
- 「同期前の仮案件（Beaverに保存していない見積もり中データ）の評価」は明示的にY1のスコープ外（§8）

つまり「問い合わせ中の案件を仮に受注確定扱いするか」という問いは、現行設計では発生しない。問い合わせ中の案件はBeaver DB上に実在する案件であり、その時点のBeaver実statusのまま（請求は`pending`のまま）評価される。「仮受注シミュレーション」という別物の仕組みは今回も追加しない（YAGNI。要望書§8「Y1に含まれないもの」を維持）。**`IntegrationController::beaverCapacityCheck()`・`BeaverCapacityService.php`は無変更**。

## 4. 採用する実装方式

新規テーブル・新規status値は追加しない。既存の`items`・`generated_task_links`をそのまま使い、全体一覧の表示条件からBeaver標準タスクの請求（`invoice`役割・`pending`状態）だけを除外する。

### 4.1 identity: `items`に`generated_task_role`を非正規化して持たせる

- `backend/db.php` `ensureTables()`: `items`テーブルへ`generated_task_role TEXT DEFAULT NULL`カラムを追加（既存の`ALTER TABLE`追加パターンを踏襲）
- `backend/services/BeaverSyncService.php` `generateStandardTasksIfMissing()`のINSERT INTO itemsに`generated_task_role`（`'estimate'`または`'invoice'`）を追加
- `generated_task_links`テーブルは冪等性保証（`UNIQUE(youkan_project_id, task_role)`）のため無変更で残す。`items.generated_task_role`は表示用の非正規化列で、生成時に1回だけ書き込まれ以降変更されない（更新経路がないため不整合は発生しない）
- `backend/BaseController.php` `mapItemRow()`に`$item['generatedTaskRole'] = $item['generated_task_role'] ?? null;`を追加。既存の`SELECT items.*`系クエリは全て自動的にこの列を返すため、`ItemController.php`等の個別SQLクエリの変更は不要
- フロントの`Item`型（`JWCADTategu.Web/src/features/core/youkan/types.ts`等）に`generatedTaskRole?: 'estimate' | 'invoice' | null`を追加

### 4.2 全体一覧の表示条件

- `JWCADTategu.Web/src/features/core/youkan/components/OverviewBoard/useOverviewItems.ts` L65-75の`allItemsRaw`構築時、`gdbIntent`から`generatedTaskRole === 'invoice' && status === 'pending'`のitemを除外する
- 既存の`hideCompleted`のようなユーザー操作トグルは追加しない。常時除外（要望書§8「管理入力を増やさない」に合致）
- 他画面・他ロジックは無変更：状況把握のPendingバケット、登録と集中のPendingセクション、全体一覧の「要判断」フィルタ/バッジ、`useYoukanViewModel.ts`のstatus振り分け（`gdbIntentRaw`等）、`GdbController.php`。除外は`OverviewBoard`専用の`useOverviewItems.ts`一箇所にのみ実装する

### 4.3 見積タスクの完了タイミング前倒し

`backend/services/BeaverSyncService.php`:

```php
private const ESTIMATE_DONE_STATUSES = ['見積済', '受注済', '進行中', '納品済', '完了', '請求済'];
```

（旧: `['受注済', '進行中', '納品済', '完了', '請求済']`）

### 4.4 無変更（調査のうえ確認・維持）

- `backend/services/BeaverCapacityService.php`（`isExcludedLeafItem`・`computeNode`・`effective_total = max(baseline, children_sum)`）
- `backend/IntegrationController.php` `beaverCapacityCheck()`
- `INVOICE_ACTIVATE_STATUSES`・`CANCELLED_STATUS`・`INVOICED_STATUS`（既に要望のライフサイクルと一致）
- `generated_task_links`テーブルのスキーマ・冪等性保証

## 5. ライフサイクル対応表

| Beaver status | 見積: 全体一覧 | 見積: 残り仕事量算入 | 請求: 全体一覧 | 請求: 残り仕事量算入 |
|:--|:--|:--|:--|:--|
| 問い合わせ | 表示（`todo`） | 算入 | 非表示（`pending`） | 算入（将来必要工数） |
| 見積済 | 非表示（`done`に自動遷移） | 非算入（`completed`扱い） | 非表示（`pending`） | 算入 |
| 受注済 | 非表示（`done`） | 非算入 | 非表示（`pending`） | 算入 |
| 進行中 | 非表示（`done`） | 非算入 | 非表示（`pending`） | 算入 |
| 納品済 | 非表示（`done`） | 非算入 | 表示（`todo`に自動遷移） | 算入 |
| 完了 | 非表示（`done`） | 非算入 | 表示（`todo`のまま） | 算入 |
| 請求済 | 非表示（`done`） | 非算入 | 非表示（`done`に自動遷移） | 非算入（`completed`扱い） |
| キャンセル | 非表示（未完了なら`cancelled`） | 除外（0） | 非表示（未完了なら`cancelled`） | 除外（0） |

「残り仕事量算入」＝`required_minutes`（`= effective_total − completed`）に計上されるか。`done`/`cancelled`後も`effective_total`自体には残るが、`completed`または`isExcludedLeafItem`により残り仕事量からは外れる（既存Y1挙動、§3.2）。

## 6. 必須テスト（TDD）

### 6.1 バックエンド（PHP）

1. Beaver status`見積済`で見積タスクが`todo→done`へ自動遷移する（§4.3の回帰）
2. `見積済`未満（`問い合わせ`）では見積タスクは`todo`のまま
3. 標準タスク生成時、`items.generated_task_role`が`'estimate'`/`'invoice'`で正しく保存される
4. `mapItemRow()`が`generatedTaskRole`を正しく返す（非生成item・生成item両方）
5. 再同期で`generated_task_role`が変化しない・重複生成しない（既存冪等性の回帰）
6. 既存のR-0161テスト（`test_r0161_beaver_standard_tasks.php`）全項目がGreenのまま（`見積済`関連1件のみ期待値更新）
7. 既存のY1/Y2 capacity回帰テスト（`effective_total`・`isExcludedLeafItem`・capacity-check）が無変更でGreenのまま

### 6.2 フロントエンド（Vitest）

1. 問い合わせ中案件: 見積（`todo`）が全体一覧に表示され、請求（`pending`）は表示されない
2. 見積済: 見積が全体一覧から消える、請求はまだ非表示
3. 受注済・進行中: 見積・請求とも全体一覧に出ない。将来必要工数として扱われている（capacity側は6.1で確認）
4. 納品済: 請求が全体一覧に表示される
5. 完了: 請求は表示されたまま
6. 請求済: 請求が全体一覧から消える
7. キャンセル: 見積・請求とも全体一覧に出ない
8. **回帰必須**: Beaver由来でない通常の`pending`アイテム（要判断キュー・Pendingバケット由来）は、本変更後も全体一覧に表示され続ける
9. 同じ案件を何度同期しても全体一覧の表示件数が増殖しない（冪等性の表示側確認）
10. 複数案件（3件以上）を同期しても、全体一覧に「請求」が並ばない（大量案件シナリオ）

## 7. 本番検証

1. Beaverテスト案件を使用し、`問い合わせ→見積済→受注済→進行中→納品済→請求済`までstatusを変化させ、各段階で以下を確認する
   - 全体一覧に何が見えるか（§5表と一致するか）
   - `GET /integrations/beaver/overview`のcapacity値（`effective_total`/`unplaced`/`completed`）
   - 二重計上がないか
2. 特に以下を必ず実機確認する
   - 受注済: 全体一覧に請求なし／capacityには将来請求工数あり
   - 納品済: 全体一覧に請求あり／capacityでは同じ30分が1回だけ（受注済時点からの増分なし）
3. 既存の要判断キュー・Pendingバケットのアイテム（Beaver標準タスクでない通常タスク）が、本変更前後で全体一覧表示に変化がないことを確認する
4. 検証用に変更したBeaverデータ・Youkan側status（見積・請求）は終了後に原状復元する

## 8. フロントエンドへの影響範囲（確認済み・変更しない箇所）

`OverviewBoard`以外の画面（パノラマ／ガント／カレンダー／フロー／登録と集中／詳細モーダル）は本書の対象外。標準タスクはこれらの画面では従来どおり通常のitemとして表示される（R-0161 §11の方針を継承）。
