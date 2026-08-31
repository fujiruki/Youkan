# 14. Beaver連携標準事務タスク（見積・請求の自動生成とcapacity算入）

- 要望: R-0161（`docs/requests_log.md`）
- 前提（完了済み）: Youkan Y1（`docs/SPEC/07_Beaver連携.md`）、Youkan Y2（`docs/SPEC/08_Beaver連携Y2.md`）
- Beaver側契約（変更なし・参照のみ）: `fujiruki/Beaver/docs/spec/R-0117_youkan_api_contract.md`、`fujiruki/Beaver/docs/spec/R-0120_youkan_work_packages_b3.md`
- Y1・Y2仕様は無変更。本書はその上に積む追加仕様であり、Y1・Y2の不変条件・API契約・負荷計算式をすべて継承する
- Y3（バッファ・仮配置・案件テンプレート拡張）には進まない。本書の範囲は見積・請求の2タスクに限定する

## 1. 目的

Beaver案件には、製作・取付などの生産作業のほかに、見積・請求という事務作業が案件登録時点から必ず存在する。特に請求は納品後に発生する仕事であり、「案件が納品済・完了・請求済になると生産負荷がcapacityから除外される」という既存のY1除外ルールと組み合わさると、請求という残務が取りこぼされる。

本機能は、Beaver案件がYoukanへ初回同期された時点で、見積・請求の2つの標準タスクを自動生成し、最初から将来必要工数としてcapacity計算へ含める。「納品済になったら初めて請求タスクを生成する」という遅延生成方式は採らない。

## 2. 不変条件（Y1 §2・Y2 §2に追加）

1. 標準タスクの同期照合は `generated_task_links`（新設、§4.1）の `(youkan_project_id, task_role)` UNIQUE制約のみで行う。案件名・タスク名では照合しない
2. 標準タスクはBeaver由来のbaselineとして生成しない。`items` の通常の末端行（`is_project=0`の子タスク）として生成する
3. **Beaver baseline（`baseline_hours`・`work_packages`）に見積・請求工数は含まれない**（§3で確定した事実）。したがって標準タスクの工数はbaselineと独立して`children_sum`に加算されるため、二重計上は発生しない
4. 既存の負荷計算式（Y1 §6・Y2 §6.2の`effective_total = max(baseline, children_sum)`、除外ステータス時は`baseline`のみ0化）は**無変更**。`backend/services/BeaverCapacityService.php` へのコード変更は行わない
5. 標準タスクは自動削除・自動アーカイブしない。案件がキャンセル・`missing_upstream`になっても、item自体は残し§5.3のルールで`status`のみ変更する
6. 同期はユーザーが変更した`title`・`estimated_minutes`・`status`等を、§5.3で定義する自動遷移ルールの範囲を超えて上書きしない

## 3. 事前調査で確定した事実（実装前必須判断1）

Beaver側契約（B1: `R-0117_youkan_api_contract.md` §4・§10、B3: `R-0120_youkan_work_packages_b3.md` §1.1）を確認した。

- `baseline_hours`の算出は「計画基準見積の Σ(`cost_factory_hours`×数量 + `cost_site_hours`×数量)」、またはフォールバックの`manual_estimated_hours`のいずれか。両方とも**工場作業・現場作業の時間のみ**で構成される
- `work_packages[].category`は`"factory"`（工場・製作作業）または`"site"`（現場・取付作業）の**固定2値**。見積・請求に相当するカテゴリは存在せず、将来値が増える場合も契約改版で通知される設計（現時点で事務作業を表すカテゴリの追加予定はない）
- Beaverの`voucher_lines`（見積明細）は建具1台あたりの`cost_factory_hours`/`cost_site_hours`のみを持ち、見積書作成・請求書発行そのものに要する事務時間を見積る列は存在しない

**結論**: 候補A（Beaver baselineに事務工数は含まれない）が確定。したがって、見積・請求タスクは案件baselineとは完全に独立した通常の末端タスクとして追加すればよく、baseline側の調整（減算・按分）は一切不要。

## 4. データ設計

### 4.1 generated_task_links テーブル（新設）

Beaver専用にせず、「Youkanがルールに基づき自動生成した標準タスク」の識別に使う汎用テーブルとする（`task_role`を増やせば将来の現調・発注・入金確認にも同じ仕組みで対応できる。§9）。Y1・Y2の`external_project_links`/`external_work_package_links`と同じく、Beaver由来値・生成物の識別は`items.meta`に置かず専用テーブルに持つ既存方針を踏襲する。

```sql
CREATE TABLE IF NOT EXISTS generated_task_links (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  youkan_project_id TEXT NOT NULL,
  youkan_item_id TEXT NOT NULL,
  task_role TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  UNIQUE(youkan_project_id, task_role)
);
CREATE INDEX IF NOT EXISTS idx_gtl_project ON generated_task_links(youkan_project_id);
```

- `task_role`: 本書では `estimate`（見積） / `invoice`（請求）の2値のみ使用
- 追加は`db.php ensureTables()`に`CREATE TABLE IF NOT EXISTS`を足す既存流儀
- `youkan_project_id`は`external_project_links.youkan_project_id`と一致する案件（Beaver由来プロジェクト）のみを対象とする。Beaver非連携の手動プロジェクトには本機能を適用しない（§5.1）

### 4.2 既存テーブルへの変更なし

`items`・`external_project_links`・`external_work_package_links`のスキーマ変更は不要。標準タスクは`items`の通常行として表現し、専用カラムを追加しない。

## 5. 標準タスクの生成・状態遷移

### 5.1 生成タイミング（実装前必須判断2: identity規則）

`BeaverSyncService::upsertProject()`内で以下のいずれかに該当する時に生成する:

- 案件を**新規作成**する時（Y1 §5.2「リンクが存在しない場合」で非除外ステータスのため`items`が新規作成される分岐）
- 既存のBeaver連携案件（`external_project_links`が既にある）を再同期した際、`generated_task_links`に当該`youkan_project_id`のレコードが1件もない場合（既存案件への後追い適用・バックフィル）

新規作成時に除外ステータスで案件自体が作成されない場合（Y1 §5.2）は、標準タスクも生成しない。

冪等性は`UNIQUE(youkan_project_id, task_role)`で担保する。同じ案件を何度同期しても標準タスクは増えない。

### 5.2 初期値（実装前必須判断3: 標準工数の保存場所）

| task_role | title | 初期status | pending_condition | estimated_minutes | parent_id / project_id |
|:--|:--|:--|:--|:--|:--|
| `estimate` | `見積` | `todo` | null | `BEAVER_STANDARD_ESTIMATE_MINUTES` | 案件の`youkan_project_id` |
| `invoice` | `請求` | `pending` | `Beaver案件が「納品済」になったら` | `BEAVER_STANDARD_INVOICE_MINUTES` | 案件の`youkan_project_id` |

- `is_project=0`（通常タスク）、`tenant_id`=案件と同じ、`created_by`=同期実行ユーザー
- 標準工数は`backend/.env`に追加する2キーで管理する（`BEAVER_API_BASE`等と同じ`CryptoService::loadEnvKey()`パターン）:

  | キー | 意味 | 既定 |
  |:--|:--|:--|
  | `BEAVER_STANDARD_ESTIMATE_MINUTES` | 見積タスクの標準工数（分） | `60` |
  | `BEAVER_STANDARD_INVOICE_MINUTES` | 請求タスクの標準工数（分） | `30` |

- 参照は`BeaverSyncService`内の単一関数（例: `getStandardTaskMinutes(string $role): int`）に集約する。tenant単位の設定テーブルは今回新設しない（Youkanは現状1テナント運用が前提であり、`tenant_settings`のような汎用設定テーブルの新設は過剰設計と判断）。将来tenant設定へ移す場合は、この関数の内部実装を差し替えるだけで済む構造とする
- 生成後の標準工数変更は、既存のitem編集機能（`estimated_minutes`のインライン編集）でユーザーが自由に行える。追加実装は不要

### 5.3 Beaverステータス連動によるstatus自動遷移（実装前必須判断4・5）

同期のたび（`upsertProject`内、リンク更新時）に評価する。**単調前進のみ**（一度`done`または`cancelled`になった標準タスクへは、以降いかなる自動遷移も行わない。ユーザーが手動でstatusを変更した後に同期がそれを巻き戻すことはない）。

**見積タスク（`task_role='estimate'`）**:
- 現在`todo`かつBeaver案件`status` ∈ `{受注済, 進行中, 納品済, 完了, 請求済}` → `done`へ（見積フェーズを超えたら見積タスクは完了したとみなす）
- 現在`todo`または`pending`かつBeaver案件`status = キャンセル` → `cancelled`へ

**請求タスク（`task_role='invoice'`）**:
- 現在`pending`かつBeaver案件`status` ∈ `{納品済, 完了}` → `todo`へ（活性化。実行候補になる）
- 現在`pending`または`todo`かつBeaver案件`status = 請求済` → `done`へ
- 現在`pending`または`todo`かつBeaver案件`status = キャンセル` → `cancelled`へ

未知のBeaverステータス値（マスタが増減された場合、Y1 §3の規約どおり負荷計算では除外しない）に対しては、標準タスクの自動遷移は行わない（現状維持。誤って先走らせるより安全側に倒す）。

### 5.4 not_ready / active の表現（実装前必須判断4）

新規の`status`値・新規カラムは追加しない。既存の`status`（`pending`含む既存値域）と`pending_condition`（`docs/SPEC/04_データ設計.md` §4.6、R-125）をそのまま使う。

- **not_ready** = `status='pending'`。既存のTodo/Today表示ロジック（`status='focus'`のみがTodayの実行候補となる設計）により、`pending`の請求タスクは自動的に今日の候補に出ない。同時に、`BeaverCapacityService.php`の末端タスク除外条件（`isExcludedLeafItem`）は`pending`を除外条件に含まないため、容量計算には通常どおり算入される（＝「今は実行不可でも将来capacityには含める」という要件そのもの）
- **active** = `status='todo'`。実行候補になりうる。ユーザーが`focus`に格上げすればToday候補に浮上する、既存の運用フローと同じ
- `pending_condition`はUI表示用の説明文としてそのまま利用する（既存の要判断キュー・Pendingバケット表示にそのまま乗る）。`review_date`は設定しない。条件充足はBeaver同期が自動検知するため、日付ベースの強制再確認（R-125の`review_date`の用途）は不要

## 6. capacityへの反映（実装前必須判断1・5、最重要）

**`backend/services/BeaverCapacityService.php`へのコード変更は不要**。理由:

1. 標準タスクは通常の末端item（`is_project=0`）として生成されるため、既存の`children_sum`計算（Y2 §6.2の再帰計算）に自動的に算入される
2. `effective_total = max(baseline, children_sum)`はそのまま成立する。baselineには見積・請求工数が含まれない（§3で確定）ため、二重計上は起こりようがない
3. 除外ステータス（納品済・完了・請求済・キャンセル）でも、既存実装は**baselineのみ**を0化し、末端タスク（`children_sum`）はそのまま残す（`isExcludedLeafItem`は`excludedProject`フラグを一切参照しない設計。調査で確認済み）。これにより、案件が納品済になっても請求タスクの工数は`effective_total`/`remaining`/`unplaced`に残り続ける。**この挙動はY1実装時点で既に正しく作られており、本書はそれを前提に乗るだけでよい**
4. `pending`ステータスの請求タスクは`isExcludedLeafItem`の除外条件（`cancelled`/`someday`/`is_archived`/`deleted_at`）に該当しないため、通常どおり容量計算に算入される
5. キャンセル時（§5.3）は標準タスクが`cancelled`になるため、`isExcludedLeafItem`の`status IN ('cancelled','someday')`条件により自動的に容量計算から除外される。「不要な将来負荷を残さない」（実装前必須判断6の回答）は既存ロジックの自然な適用で満たされる

## 7. Beaverステータスとの関係（実装前必須判断7）

Y1 §5.2の除外ステータス処理（案件baselineのみ0化、案件・子タスクは削除しない）は無変更。案件全体を一括でcapacity除外する処理は元々Y1に存在しない（除外の単位は常にbaselineのみ）ため、本書が新たに見直す必要はない。

標準タスクの状態遷移は§5.3で独立管理する。「請求済」になったら請求タスクを**自動的に`done`へ**遷移させる（Youkan側の手動操作を必須にしない）。判断根拠: 要望のUX原則「ステータス変更時に手動でタスクを活性化することを要求しない」に基づき自動化を優先する。ユーザーが実務上先に完了操作をしていた場合は§5.3の単調前進ルールにより上書きされない。

## 8. 業務ライフサイクルまとめ

```text
案件登録直後（Beaver初回同期）
  見積: todo（active・実行候補）
  請求: pending（not_ready・pending_condition表示、Today候補に出ない）
  → capacity: 見積+請求の両方が最初からeffective_totalに算入される

Beaver案件 見積済→受注済等に進行
  見積: done（自動遷移）
  請求: pending のまま

Beaver案件 納品済／完了
  見積: done
  請求: todo（自動で活性化・実行候補になる）
  生産系baseline: 0扱い（Y1の既存ロジック、無変更）
  → 請求タスクの工数は末端item合計として残り続ける

Beaver案件 請求済
  見積: done
  請求: done（自動遷移）

Beaver案件 キャンセル
  見積: cancelled（未完了なら）
  請求: cancelled（未完了なら）
  → 両方ともcapacity計算から自動除外（既存のcancelled除外ルールの自然な適用）
```

## 9. 将来拡張（Y3以降・今回実装しない）

- `generated_task_links.task_role`に新しい値（`survey`＝現調、`order`＝発注、`payment_check`＝入金確認等）を追加するだけで、同じ生成・遷移の仕組みを拡張できる設計にしてある。ただし今回はテーブル・関数とも`estimate`/`invoice`の2値専用に実装してよく、汎用化のための抽象化（プラグイン機構・設定UI等）は作らない（YAGNI）
- 案件テンプレート機能（要望書§16相当）への一般化
- 標準工数のtenant設定UI化

## 10. 必須テスト（バックエンドPHP・TDD）

1. Beaver案件初回同期で見積・請求タスクが生成される
2. 再同期で重複生成しない（`UNIQUE(youkan_project_id, task_role)`）
3. manual baseline案件でも標準タスクが生成される
4. estimate baseline案件でも標準タスクが生成される（work_packagesと共存）
5. work_packagesあり案件で標準タスクとwork_packageが混在してもchildren_sumが正しい
6. 見積・請求タスクの初期`estimated_minutes`が`.env`既定値と一致する
7. `.env`の標準工数変更後、新規生成タスクに反映される
8. 標準タスク工数をユーザーが変更後、`effective_total`に反映される（既存item編集機能の確認）
9. baselineとの二重計上がない（`baseline_hours`にestimate/invoice相当が含まれないことを踏まえたテスト値で検証）
10. work_packageとの二重計上がない
11. 子タスク分解後も二重計上がない（既存Y2ロジックの回帰）
12. 納品前: 請求タスクは存在（`pending`）・Today候補に出ない・`effective_total`/`unplaced`には算入される
13. 納品済: 生産baselineが0になる・請求タスクは`todo`に活性化・工数は残る
14. 請求済: 請求タスクが`done`になる
15. キャンセル: 見積・請求タスクが`cancelled`になり、容量計算から除外される（未完了の場合）。既に`done`だった場合は変更しない
16. Y1 capacity-check回帰（既存テストGreen維持）
17. Y2再帰effective_total回帰（既存テストGreen維持）
18. ProjectRegistryScreen回帰（表示崩れなし。標準タスクはprojectRegistry上「通常の子タスク」としてそのまま表示されればよく、UI変更は行わない）

## 11. フロントエンド

変更なし。標準タスクは通常のitemとして生成されるため、全体一覧・ガント・パノラマ等の既存表示にそのまま乗る。`ProjectRegistryScreen`のBeaverバッジ・結論1行（Y1 §9・Y2 §11）にも変更を加えない。

## 12. 本番検証

1. Beaverテスト案件を作成（または既存のテスト案件を再利用）
2. Youkan同期を実行し、見積・請求タスクが自動生成されることを確認
3. 請求タスクが`pending`（Today候補に出ない）であることを確認
4. `GET /integrations/beaver/overview`のcapacity値（`effective_total`/`unplaced`）に見積・請求の工数が含まれることを確認
5. Beaver側で案件statusを「納品済」へ変更し再同期
6. 生産baselineが0になり、請求タスクが`todo`に活性化されることを確認
7. 請求タスクの工数が`effective_total`に残っていることを確認
8. Beaver側でstatusを「請求済」へ変更し再同期、請求タスクが`done`になることを確認
9. 検証用に変更したBeaverデータ・生成されたYoukanタスクは終了後に削除・復元する
