# 08. Beaver連携（Y2: work_packages段階分解）

- 要望: R-154（`docs/requests_log.md`）
- 上位計画: `docs/reference/vision/2026-08-25_Beaver-Youkan連携開発計画.md`（§12 Y2節）
- 前提（完了済み）: Youkan Y1（`docs/SPEC/07_Beaver連携.md`）、Beaver B3（`fujiruki/Beaver/docs/spec/R-0120_youkan_work_packages_b3.md`）、Beaver B1契約への`work_packages`追加（`fujiruki/Beaver/docs/spec/R-0117_youkan_api_contract.md` §10）
- Y1仕様（`07_Beaver連携.md`）は無変更。本書はその上に積む追加仕様であり、Y1の不変条件・API契約・レスポンス形式をすべて継承する

## 1. 目的

Beaverの見積内訳（`work_packages`）を、Youkan上で「案件 → work_package → 実行タスク」という3階層以上の仕事の構造として段階的に分解できるようにする。分解は任意。分解しなくてもY1の未配置負荷としてそのまま機能し続ける。

## 2. 不変条件（Y1の§2に追加）

1. work_packageの同期照合は`external_work_package_id`のみ。ラベル（`label`）では照合しない
2. work_packageのbaseline（`estimated_hours`）を普通のタスク（子タスク）として生成しない
3. 案件baseline・work_package baseline・Youkan子タスクの三者で二重計上しない（§6で一般化した`effective_total = max(baseline, 子の有効合計)`を各階層で再帰適用する）
4. 同期はYoukanで追加した子タスク・meta・ユーザー編集を削除・上書きしない（同期が触るのはリンクテーブルと、work_package itemの`title`のみ。Y1同様`items.meta`は使わない）
5. Beaver側でwork_packageが消えても、Youkan側のwork_package item・子タスクを自動削除・自動アーカイブしない（`missing_upstream`として残す）
6. 自動で日付へ配置・保存しない（Y1と同じ）
7. バッファ機能・高度な人員割当提案・自動スケジューリングには進まない（Y3）

## 3. work_packageのYoukan内表現

**work_packageは`items`の1行として、`is_project=1`で表現する。**

理由:
- `is_project=1`のitemは、Y1の負荷集計（末端タスク判定）から自動的に除外される（`BeaverCapacityService::computeLinkLoads()`が`!empty($it['is_project'])`を末端除外条件に含む。`backend/services/BeaverCapacityService.php:204`）。これにより、work_package item自体の`estimated_minutes`フィールドを負荷計算に一切使わない設計にできる（後述§6でも`estimated_minutes`は使わない）
- 意味的に「複数の子タスクへ分解されうる仕事のまとまり」は、Youkan既存モデルの「プロジェクト」の定義（子タスクを持てる、それ自体が仕事のグループ）と一致する
- 既存の`getHierarchicalProjects`（`JWCADTategu.Web/src/features/core/youkan/logic/hierarchy.ts`。プロジェクト同士の親子ツリー、`depth`インデント表示）がそのままwork_packageの入れ子表示に使える

**設定内容:**
- `is_project = 1`
- `project_id` = 案件Youkanプロジェクト（`external_project_links.youkan_project_id`）のid
- `parent_id` = NULL（案件直下。work_packageはBeaver側のフラットな配列であり、Beaver起源のwork_package同士に親子関係はない）
- `title` = `label`（Beaver側表示ラベル。空なら`external_work_package_id`をフォールバック表示に使わず、Beaver契約どおり`"明細{line_no}"`相当のBeaver側補完値をそのまま使う）
- `estimated_minutes` = 常にNULL（使わない。baselineは`external_work_package_links.baseline_minutes`にのみ持つ）
- `tenant_id` = 案件と同じ
- `created_by` = 同期実行ユーザー

**実装時の必須対応（指揮AI事前調査済み）:** `ProjectController.php`の一覧クエリ（45・69・86・104行目）は`is_project = 1`のみで絞っており、`project_id IS NULL`条件を持たない。これはis_project=1のitem同士が親子ネスト（`getHierarchicalProjects`によるプロジェクト同士の親子ツリー表示。`ProjectRegistryScreen.tsx`で実際に使用中）を既に許容する設計であるため、**`project_id IS NULL`条件を追加してはならない**（既存の子プロジェクト構造が一覧から消えるデグレになる）。

代わりに、上記4箇所のSELECTに`AND NOT EXISTS (SELECT 1 FROM external_work_package_links WHERE youkan_item_id = items.id)`を追加し、work_package itemのみを一覧から除外すること。work_package自体はProjectRegistryScreenの案件カード展開（§11）でのみ表示され、独立した「プロジェクト」として一覧に並ばない。

## 4. データ設計

### 4.1 external_work_package_links テーブル（新設）

Y1の`external_project_links`と同型のパターン。Beaver由来の値はすべてここに持つ（`items.meta`には置かない。理由はY1仕様書§4.1と同じ: `updateEntity`が`meta`を丸ごと上書きするため）。

```sql
CREATE TABLE IF NOT EXISTS external_work_package_links (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  source_system TEXT NOT NULL DEFAULT 'beaver',
  external_work_package_id TEXT NOT NULL,
  external_project_id TEXT NOT NULL,
  youkan_project_id TEXT NOT NULL,
  youkan_item_id TEXT NOT NULL,
  label TEXT,
  category TEXT,
  baseline_minutes INTEGER NOT NULL,
  source_voucher_id INTEGER,
  source_line_id INTEGER,
  source_updated_at TEXT,
  sync_state TEXT NOT NULL DEFAULT 'ok',
  last_synced_at INTEGER,
  created_at INTEGER NOT NULL,
  UNIQUE(tenant_id, source_system, external_work_package_id)
);
CREATE INDEX IF NOT EXISTS idx_ewpl_youkan_item ON external_work_package_links(youkan_item_id);
CREATE INDEX IF NOT EXISTS idx_ewpl_project ON external_work_package_links(tenant_id, external_project_id);
```

- `baseline_minutes` = Beaver `estimated_hours × 60`（四捨五入）。Beaver契約上`estimated_hours`は常に`>0`のためNULL許容にしない
- `category`: `factory` / `site` / それ以外（未知値は契約上「将来値」として文字列のまま保持。§9参照）
- `sync_state`: `ok` ／ `missing_upstream`（直近の同期でBeaver応答のwork_packages集合から消えた）
- `youkan_project_id`は`external_project_links.youkan_project_id`と一致する（結合の簡略化のため冗長に持つ。Y1の`external_project_links`設計と同じ考え方）
- 追加は`db.php ensureTables()`に`CREATE TABLE IF NOT EXISTS`を足す既存流儀

### 4.2 既存テーブルへの変更なし

`items`・`external_project_links`・`external_sync_state`のスキーマ変更は不要。work_packageは`items`の通常行として表現し、専用カラムを追加しない。

## 5. 同期仕様（Y1の§5に追加）

work_package同期は、Y1の案件同期（`POST /integrations/beaver/sync`、`diff`/`full`）の一部として同じトランザクション内で行う。新しいエンドポイントは追加しない（Beaver B1契約は`work_packages`を既存の案件レスポンスに含めているため）。

### 5.1 upsert規則（案件1件の同期ごとに、その案件の`work_packages`配列を処理）

前提: `work_packages`が非空になりうるのは`baseline_source='estimate'`の案件のみ（Beaver契約）。`manual`/`none`の案件は常に`work_packages: []`であり、この節の処理は何もしない。

**Beaver応答の`external_work_package_id`ごとに:**

- **リンクが存在しない場合:**
  - `items`へ新規行作成（§3の設定内容どおり）
  - `external_work_package_links`へリンク作成（`baseline_minutes`・`category`・`source_voucher_id`・`source_line_id`・`source_updated_at`・`sync_state='ok'`）
- **リンクが存在する場合:**
  - リンク行の`label`・`category`・`baseline_minutes`・`source_voucher_id`・`source_line_id`・`source_updated_at`・`sync_state='ok'`（missing_upstreamから復帰した場合を含む）を更新
  - `label`が前回と異なる場合のみ、work_package itemの`title`をBeaver値で上書き（Y1の案件`title`更新と同じ「Beaverが正本」の扱い）
  - `estimated_minutes`（常にNULL維持）・子タスク・meta・依存関係など、work_package itemのそれ以外のフィールドとその配下には一切触れない

**今回のBeaver応答に含まれなかった、前回`sync_state='ok'`だったリンク:**
- `sync_state='missing_upstream'`にする（§7参照）。work_package item・その子タスクは削除・アーカイブしない

**`work_packages`が空配列で返ってきた場合（baseline_sourceがmanual/noneに変わった等）:**
- その案件に紐づく既存の`ok`状態リンクを全て`missing_upstream`にする（個別消失と同じ扱い）

冪等性: 同じ`external_work_package_id`を何度同期してもwork_package itemは増えない（UNIQUE制約＋上記規則、Y1の案件同期と同じ設計）。

### 5.2 diff同期での欠落検知の限界

Y1の`diff`同期（`updated_after`付き）は「更新された案件」のみ返るため、ある案件が全く更新されていない同期では、その案件の`work_packages`も再取得されない。`missing_upstream`検知はY1と同様、`full`同期（手動「今すぐ同期」ボタン）でのみ確実に行える。`diff`同期は「見えているwork_packagesの内容更新」のみを反映し、欠落検知は行わない（Y1の案件消失検知と同じ制限を踏襲）。

## 6. 負荷モデル（再帰的effective_total計算）

Y1の§6（`baseline`/`decomposed`/`effective_total`/`completed`/`remaining`/`placed`/`unplaced`）を、work_package層を含む任意深さのツリーへ一般化する。**Y1のAPIレスポンス形式（`GET /integrations/beaver/overview`・`POST /integrations/beaver/capacity-check`のフィールド）は一切変更しない**。案件（トップ）レベルの`load`オブジェクトは本節の再帰計算で置き換えて算出するが、出力される値の意味・フィールド名はY1と同一。

### 6.1 ノードの種別

対象プロジェクト配下（`project_id`または`parent_id`連鎖）の各itemを、以下のいずれかに分類する。

| 種別 | 判定 | baselineの有無 |
|:--|:--|:--|
| 案件ノード（root） | `external_project_links.youkan_project_id`と一致 | あり（`external_project_links.baseline_minutes`） |
| work_packageノード | `external_work_package_links.youkan_item_id`と一致 | あり（`external_work_package_links.baseline_minutes`） |
| 中間ノード | 上記以外で子を持つ（`is_project`不問） | なし |
| 末端ノード（leaf） | 子を持たない | — |

末端ノードの除外条件はY1と同じ: `deleted_at`あり・`is_archived`・`is_project=1`・`status IN ('cancelled','someday')`のいずれかに該当するものは集計対象外（0扱い）。

### 6.2 再帰計算式

各ノード`N`について:

```text
leaf_value(N)      = 末端なら estimated_minutes（未完了時のみ decomposed に算入。除外条件該当は0）
children_sum(N)    = Σ effective_total(child) for child in children(N)
effective_total(N) = 末端の場合            leaf_value(N)
                    = baselineありの場合    max(baseline(N), children_sum(N))
                    = baselineなし中間の場合 children_sum(N)

completed(N)       = 末端の場合 status='done'なら estimated_minutes、それ以外0
                    = 子を持つ場合 Σ completed(child)

placed(N)          = 末端の場合 未完了かつ(prep_dateまたはdue_dateあり)なら estimated_minutes、それ以外0
                    = 子を持つ場合 Σ placed(child)

remaining(N) = max(0, effective_total(N) - completed(N))
unplaced(N)  = max(0, remaining(N) - placed(N))
```

案件ノード（root）の`effective_total`/`remaining`/`unplaced`が、Y1のAPIレスポンスにおける`effective_total`/`remaining`/`unplaced`と完全に一致する（既存フィールド定義は無変更）。

work_packageが1つも存在しない案件（`manual`/`none`案件、またはY1時点で同期済みの既存案件）では、`children(root)`が全て通常の末端タスクのみとなり、本計算式はY1の2階層ロジック（`effective_total = max(baseline, 末端合計)`）と数学的に同一の結果を返す。**Y1既存案件との後方互換はこの一般化によって自動的に満たされる**（分岐を作らない）。

### 6.3 表示用の仮想残量・超過差分

`virtual_residual(N) = max(0, baseline(N) - children_sum(N))`（baselineを持つノードのみ。UIの「未分解◯h」）
`overage(N) = max(0, children_sum(N) - baseline(N))`（UIの「+◯h」超過表示）

`virtual_residual`は通常タスクとして生成しない。API・UIともに計算値としてのみ返す。

例（要望原文の例に対応）:
- 案件baseline20h、work_packages合計（未分解時）15h → `children_sum(root)=15h`、`virtual_residual(root)=5h`、`effective_total(root)=max(20,15)=20h`
- work_package「製作」baseline12h、子タスク合計10h → `virtual_residual(製作)=2h`、`effective_total(製作)=12h`
- 子タスク合計が13hに増えた場合 → `overage(製作)=1h`、`effective_total(製作)=13h`（12hのbaselineは書き換えず保持）

### 6.4 capacity simulationへの反映

EDF仮想充当（`BeaverCapacityService::simulate()`）は案件ノードの`unplaced`のみを入力として使う設計であり、内部がツリー集計になっても呼び出し側のインターフェースは変わらない。**§7（シミュレーション）のロジック・出力フィールドは無変更。** work_packageや子タスクを新設しても、案件の`unplaced`が正しく再帰計算されることで自動的にシミュレーションへ反映される。

## 7. upstream missing規則

`sync_state='missing_upstream'`のwork_packageリンクについて:

- **§6の負荷計算には引き続き参加する**（`baseline_minutes`をそのまま使い続ける）。同期で見えなくなったことを「仕事が消えた」と解釈して負荷を0にしない。Beaver側の版切替（見積改訂・行入れ替え）による一時的な消失の可能性が高いため（Beaver B3契約§1.5・§3）、実際に不要になったかはユーザー判断に委ねる
- UIに「Beaver側から消えています・要確認」バッジを表示する（Y1の案件`missing_upstream`表示と同じパターン）
- work_package item・その配下の子タスクは自動削除・自動アーカイブしない。子タスクの有無で扱いを分岐させる自動処理も行わない（子タスクなしの場合に「非アクティブ化可能」と自動判定する仕組みは持たない。判断は常にユーザー）
- ユーザーが不要と判断した場合は、既存のアーカイブ機能（`is_archived`）を通常タスク・プロジェクトと同じ操作で使う。Y2で新規のアーカイブUIは追加しない
- 同じ`external_work_package_id`が後の同期で再び現れた場合（Beaver側で見積が戻された等）、`sync_state`は`ok`に復帰し、`baseline_minutes`等はBeaver最新値で更新される。work_package itemやその子タスクを作り直さない（既存の行をそのまま使う）

## 8. 完了済みタスク・日付配置の扱い

- 完了済み末端タスク（`status='done'`）は§6.2の`completed`にそのまま算入される（Y1と同じ規則の再帰版）
- work_package item自体に対する完了操作は想定しない（work_packageはグルーピングノードであり、「完了」はその配下の実行タスクに対して行う操作）。work_package itemの`status`はUI上変更不可にする必要はないが、集計上`status`は参照しない（`estimated_minutes`同様、work_package itemは負荷計算の対象外のノードとして扱われるため）
- 日付配置済み/未配置の判定（`placed`/`unplaced`）もY1と同じ規則をそのまま再帰適用する（§6.2）

## 9. category（factory/site）の扱い

Y2では表示用ラベルとしてのみ保持する。担当割当・集計区分としての特別なロジックは持たせない（Y3以降の検討事項）。未知の値（Beaver契約上、将来カテゴリが増える可能性がある）は無視せず、そのまま文字列として保持・表示する（前方互換。Beaver B3契約§10と同じ方針）。

## 10. API（Y2での変更）

**新規エンドポイントは追加しない。** Y1の3エンドポイント（`/integrations/beaver/sync`・`/integrations/beaver/overview`・`/integrations/beaver/capacity-check`）のレスポンス形式は不変。

`GET /integrations/beaver/overview`のみ、ProjectRegistryScreen向けにwork_package行を追加で返す（既存`links[]`各要素への追加フィールドとして`work_packages`配列を追加。後方互換の追加）。

```json
{
  "external_project_id": 123,
  "youkan_project_id": "...",
  "...": "既存Y1フィールドはすべて無変更",
  "load": { "baseline": 1200, "decomposed": 1380, "effective_total": 1380, "...": "..." },
  "work_packages": [
    {
      "external_work_package_id": "beaver:voucher:60:line:201:factory",
      "youkan_item_id": "...",
      "label": "建具A 製作",
      "category": "factory",
      "baseline_minutes": 480,
      "decomposed_minutes": 420,
      "effective_total_minutes": 480,
      "virtual_residual_minutes": 60,
      "overage_minutes": 0,
      "sync_state": "ok"
    }
  ]
}
```

`capacity-check`（B2向け、Beaver→Youkan方向のAPI）は§6.4のとおり出力を変更しない。Beaver側はwork_package単位の内訳を必要としていない（B3契約§6.6「Y2側の段階分解ロジックが本格的な消費者になる」の消費はYoukan内部で完結する）。

## 11. フロントエンド（最小統合）

新しい専用画面は作らない。`ProjectRegistryScreen`のみ変更する。

- `ProjectCard`（`ProjectRegistryScreen.tsx`）内、既存のBeaverバッジ＋結論1行（`data-testid="beaver-badge"`）の直後に、`work_packages`が非空の場合のみ1行を追加: 「分解済み◯h／未分解◯h」または超過時「基準◯h→現在計画◯h（+◯h）」（§6.3の`virtual_residual`/`overage`をそのまま文言化）
- 案件カードの展開（既存の`getHierarchicalProjects`による階層ツリー表示、`depth`インデント）で、work_package行を`depth+1`として表示。各行に同様の「基準◯h／分解済み◯h」1行を添える。`missing_upstream`のwork_packageには「Beaver側から消えています・要確認」バッジを表示
- 状態管理は既存の`useBeaverIntegration.ts`と並列に`useWorkPackageSummary.ts`（または同ファイル内の拡張）を追加し、`Map<youkanItemId, WorkPackageSummary>`を返す薄いフックとする（既存の`linkByProjectId`パターンを踏襲）
- work_package配下への子タスク新規作成は、既存の`SubtaskListWidget`/`useSubtasks.ts`のパターン（`ApiClient.createItem({ title, parentId: workPackageItemId, projectId, tenantId, status: 'inbox' })`）をそのまま使う。Y2で新しい作成UIは追加しない
- `.env`未設定・overview取得失敗時はY1と同じくBeaver関連UIを一切出さない（縮退方針の継続）

## 12. Y2の必須テスト

バックエンド（PHP）:
- [ ] work_packagesなしの案件（既存Y1案件）で挙動が変わらない（後方互換）
- [ ] work_package 1件の同期・負荷計算
- [ ] 複数work_packagesの同期・負荷計算
- [ ] 同一`external_work_package_id`での冪等upsert（複数回同期してもitem増加なし）
- [ ] work_package名（label）変更時、work_package itemのtitleのみ更新され子タスクは無変更
- [ ] work_package工数（baseline_minutes）変更時、リンクのみ更新されeffective_total再計算に反映
- [ ] Beaver再同期（diff/full）でユーザー編集（子タスクのtitle/estimated_minutes/担当/依存関係）が保持される
- [ ] work_package消失（Beaver応答から消える）→ `missing_upstream`になり子タスク・item削除なし
  - [ ] 子タスクなしで消失
  - [ ] 子タスクありで消失
- [ ] 案件baseline > work_packages合計（未分解残量が正しい）
- [ ] 案件baseline = work_packages合計
- [ ] 案件baseline < work_packages合計（Beaver契約上ありうる超過ケース）
- [ ] work_package baseline > 子タスク合計（virtual_residualが正しい）
- [ ] work_package baseline = 子タスク合計
- [ ] work_package baseline < 子タスク合計（overageが正しく、baselineは書き換えない）
- [ ] 完了済み子タスク（`status='done'`）がcompletedに正しく算入される
- [ ] 日付ありタスク（placed算入）
- [ ] 日付なしタスク（unplaced算入）
- [ ] Y1 capacity simulation（EDF）が二重計上しない（work_package層を挟んでも`unplaced`が正しい1回だけの値になる）
- [ ] Beaver完了/キャンセル案件（除外ステータス）の場合、work_packagesも含め負荷0（Y1の除外ルールを継承）
- [ ] manual baselineからestimate/work_packagesへ切替（見積追加により初めてwork_packagesが現れるケース）
- [ ] estimate更新後の再同期でwork_package baselineのみ更新
- [ ] B1/B2回帰（Y1の全既存テストがGreenのまま）

フロントエンド（vitest）:
- [ ] `useWorkPackageSummary`（または拡張後の`useBeaverIntegration`）の集計ロジック単体テスト
- [ ] `ProjectCard`のwork_package行表示（分解済み/未分解、超過表示）
- [ ] `missing_upstream`バッジ表示
- [ ] work_packagesが空の案件でY1表示（Beaverバッジ＋結論1行のみ）が変わらないこと

## 13. 本番検証（デプロイ後）

1. Beaver実案件（またはテスト案件）でwork_packagesがYoukanへ同期されることを確認
2. Youkanでwork_package配下へ子タスクを1〜2個作成
3. 分解前後で案件総負荷（`effective_total`）が二重計上されないことを確認
4. 子タスク工数を増やしてwork_package baseline超過時に`effective_total`が増えることを確認
5. Beaver側の見積工数を変更
6. 再同期してwork_package baselineのみ更新され、Youkan子タスクが保持されることを確認

## 14. Y3へ渡す事項

- バッファ機能（計画書§14〜15）: 本書のwork_package baselineとYoukan計画工数の差分（`overage`）を活用できる
- 高度な人員割当提案・自動スケジューリング
- テンプレート提案（計画書§16）
- work_packageの`category`（factory/site）を担当割当・集計区分として活用する拡張
- `missing_upstream`が長期間放置された場合のリマインド等（Y2では通知を一切出さない方針を継続。必要になれば要検討）
