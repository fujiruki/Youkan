# 07. Beaver連携（Y1: 受け口・未配置負荷・容量シミュレーション）

- 要望: R-153（`docs/requests_log.md`）
- 上位計画: `docs/reference/vision/2026-08-25_Beaver-Youkan連携開発計画.md`（Y1のみ。Y2以降は本仕様の範囲外）
- Beaver側API契約（B1・正本はBeaverリポジトリ）: `fujiruki/Beaver/docs/spec/R-0117_youkan_api_contract.md`
- Youkan側が提供するcapacity-check API契約（B2向け・Y1成果物）: `docs/SPEC/R-153_capacity_check_api_contract.md`

## 1. 目的

Beaverに案件を登録しただけの粗い工数（baseline_hours）でも、Youkan上で「未配置負荷」として認識し、既存仕事とキャパシティを踏まえて「納期までに入るか」を判断できるようにする。

Y1は読み取り専用シミュレーションまで。自動的に日程へ配置・保存しない。シミュレーション結果は保存しない。

## 2. 不変条件（計画書§2と発注者指示による禁止事項）

1. 同期照合は Beaver `external_project_id`（整数・stable）のみ。案件名・project_codeでは照合しない
2. `baseline_hours` を普通のタスク（items行）として生成しない
3. Beaverの基準工数とYoukanの詳細タスクを二重計上しない（`effective_total = max(baseline, 分解済み合計)`）
4. 日付未配置の仕事も仕事量として消さない
5. 「カレンダーに空白がある＝空いている」と判定しない（未配置負荷を差し引いた実質余力で判断する）
6. 同期はYoukanで追加した子タスク・meta・その他ユーザー編集を削除・上書きしない（同期が触るのはリンクテーブルと、プロジェクトitemの `title`・`due_date`・`client_name` のみ）
7. 「藤田建具店」等のテナント名をハードコードしない。対象テナントIDは設定（`.env`）で解決する
8. Beaver側から案件が消えても、Youkan側のプロジェクト・子タスクを自動削除しない（`missing_upstream` として要確認扱い）

## 3. 設定（`backend/.env`）

読み込みは既存の `CryptoService::loadEnvKey()` 方式に倣う。

| キー | 意味 | 既定 |
|:--|:--|:--|
| `BEAVER_API_BASE` | Beaver連携APIのベースURL | なし（未設定なら連携機能は503。`index.php` のGoogle連携と同じ縮退パターン） |
| `BEAVER_API_TOKEN` | Bearerトークン（Beaver側 `YOUKAN_API_TOKEN` と同値。発行は発注者経由、Gitに書かない） | なし |
| `BEAVER_TENANT_ID` | 同期先YoukanテナントID | なし |
| `BEAVER_EXCLUDED_STATUSES` | 基準負荷から除外するBeaverステータスのカンマ区切りリスト | `納品済,完了,請求済,キャンセル`（コード内既定。envで上書き可） |

- 除外は「順序依存（納品済以降）」ではなく明示リストで判定する。Beaverのステータスマスタは増減・改名されうるため、未知の値は除外せず受け入れる（負荷に含める）
- 開発環境のBeaverは `http://localhost:8003`

## 4. データ設計

### 4.1 external_project_links テーブル（新設）

Beaver由来の値はすべてこのテーブルに持つ。`items.meta` には置かない（`updateEntity` がmetaを丸ごと上書きするため、ユーザー編集と同期が衝突する）。

```sql
CREATE TABLE IF NOT EXISTS external_project_links (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  source_system TEXT NOT NULL DEFAULT 'beaver',
  external_project_id TEXT NOT NULL,
  youkan_project_id TEXT NOT NULL,
  source_name TEXT,
  source_code TEXT,
  source_customer_name TEXT,
  source_status TEXT,
  source_delivery_date TEXT,
  baseline_minutes INTEGER,
  baseline_source TEXT,
  baseline_updated_at TEXT,
  source_updated_at TEXT,
  sync_state TEXT NOT NULL DEFAULT 'ok',
  last_synced_at INTEGER,
  created_at INTEGER NOT NULL,
  UNIQUE(tenant_id, source_system, external_project_id)
);
CREATE INDEX IF NOT EXISTS idx_epl_youkan_project ON external_project_links(youkan_project_id);
```

- `baseline_minutes` = Beaver `baseline_hours × 60`（四捨五入）。null許容（`baseline_source='none'`）
- `sync_state`: `ok` ／ `missing_upstream`（全件同期でBeaver一覧から消えた） ／ `target_missing`（Youkan側プロジェクトがゴミ箱等で見つからない）
- 追加は `db.php ensureTables()` に `CREATE TABLE IF NOT EXISTS` を足す既存流儀（`user_google_calendars` と同型）

### 4.2 external_sync_state テーブル（新設）

差分同期のカーソルと直近結果を1行で持つ。

```sql
CREATE TABLE IF NOT EXISTS external_sync_state (
  tenant_id TEXT NOT NULL,
  source_system TEXT NOT NULL,
  last_updated_after TEXT,
  last_synced_at INTEGER,
  last_error TEXT,
  PRIMARY KEY(tenant_id, source_system)
);
```

- `last_updated_after`: 前回同期で受け取った最大 `updated_at`（オフセット付きISO 8601のまま保存し、次回 `updated_after` にそのまま渡す）
- `last_error`: 直近同期の失敗理由（成功時NULL）。Beaver到達不能でも既存データは消さず、UIに「同期できませんでした（前回同期: X）」を出すための材料

## 5. 同期仕様

### 5.1 エンドポイント

`POST /integrations/beaver/sync`（`IntegrationController` に追加）

- Body: `{ "mode": "diff" | "full", "force": bool }`（省略時 `diff` / `false`）
- 認証: `BaseController::authenticate()` 共通（JWT／共有セッション／api_token）。呼び出しユーザーが `BEAVER_TENANT_ID` のメンバーでなければ403
- クールダウン: `force=false` かつ前回成功同期から**120秒以内**なら同期せず `{ "skipped": true, "last_synced_at": ... }` を200で返す。`force=true`（手動「今すぐ同期」）は常に実行
- `diff`: Beaver一覧APIへ `updated_after=last_updated_after` を付けて取得（`next_cursor` がnullになるまでページング）
- `full`: `updated_after` なしで全件取得。応答に含まれなかった既知リンクを `sync_state='missing_upstream'` にする（fullのみが欠落検知できる）。手動ボタンはfullを使う
- 応答: `{ "synced": n, "created": n, "updated": n, "skipped": bool, "last_synced_at": ..., "error": string|null }`

### 5.2 upsert規則（案件1件ごと）

照合キーは `(tenant_id, 'beaver', external_project_id)` のみ。

**リンクが存在しない場合:**
- `source_status` が除外リストに含まれるなら**作成しない**（過去の完了・キャンセル案件を初回同期で大量に取り込まない）
- それ以外は、Youkanプロジェクト（`items`）を新規作成してリンクを張る:
  - `is_project=1`、`title`=Beaver案件名、`due_date`=`delivery_date`、`client_name`=`customer_name`、`tenant_id`=`BEAVER_TENANT_ID`、`created_by`=同期実行ユーザー。その他は既存のプロジェクト作成慣習（`ProjectController`）に合わせる
  - `baseline_hours` がnullでもプロジェクトは作る（負荷0の受け皿。粗い状態でも使えることを最優先）

**リンクが存在する場合:**
- リンク行のBeaver由来カラムを全て更新（`source_updated_at` が前回と同じでもupsertは冪等）
- Youkanプロジェクトitemは `title`・`due_date`・`client_name` のみBeaver値で上書き（Beaverが正本。計画書§18）
- 子タスク・meta・estimated_minutes・担当・依存関係・その他ユーザー編集には**一切触れない**
- ステータスが除外リスト入りに変わった場合もプロジェクト・子タスクは削除・アーカイブしない（基準負荷が0になるだけ。`キャンセル` はUIで要確認表示）
- リンク先プロジェクトが `deleted_at IS NOT NULL` の場合は更新せず `sync_state='target_missing'`（再作成しない。増殖防止が優先）

冪等性: 同じ案件を何度同期してもプロジェクトは増えない（UNIQUE制約＋上記規則）。

### 5.3 エラー時の縮退

- Beaver到達不能・401・タイムアウト: 既存リンク・プロジェクトはそのまま。`external_sync_state.last_error` に記録し、応答の `error` で返す。UIは前回同期時刻とともに表示
- `.env` 未設定: `/integrations/beaver/*` は503＋「.env に BEAVER_API_BASE 等を設定してください」（Google連携と同じパターン）

## 6. 負荷モデル（二重計上しない計算）

リンクされたプロジェクトごとに以下を定義する。集計対象の「末端タスク」= 対象プロジェクト配下（`project_id` または `parent_id` 連鎖で到達）の、子を持たないitemで、`deleted_at IS NULL`・`is_archived=0`・`status NOT IN ('cancelled','someday')`。

```text
baseline        = 除外ステータスなら 0、それ以外は baseline_minutes（nullは0）
decomposed      = 末端タスクの estimated_minutes 合計
effective_total = max(baseline, decomposed)
completed       = うち status='done' の末端タスクの estimated_minutes 合計
remaining       = max(0, effective_total - completed)
placed          = 未完了かつ日付あり（prep_date または due_date を持つ）末端タスクの estimated_minutes 合計
unplaced        = max(0, remaining - placed)
```

- `unplaced` には「基準工数のうちまだ分解していない仮想残量」と「分解済みだが日付未定のタスク」の両方が含まれる。仮想残量を通常タスクとして生成しない
- 子が基準を超えたら `effective_total` は子合計（基準は上書きも削除もしない。表示は「基準5h／現在6h／+1h」）
- 除外ステータス（納品済等）でも、Youkan側で作った「請求処理 0.5h」等の通常タスクは通常の負荷として残る（消えるのはBeaver由来の基準負荷だけ）
- `someday` は既存ルールどおり負荷から除外し、`decomposed`・`completed` にも数えない（その分は仮想残量として残る＝仕事量は消えない）

## 7. 容量シミュレーション（読み取り専用）

### 7.1 入力

- 対象テナント: `BEAVER_TENANT_ID`
- 日次キャパシティ: 既存の会社分母ルール（`memberships.is_core=1` のメンバーの `capacity_profile`／`daily_capacity_minutes` から日別に算出して合計）。フロント `QuantityEngine.calculateCapacityForDate` のテナント集計と同一規則をPHPに実装し、**共有フィクスチャでフロント/バックの数値一致をテストする**（`capacity.ts` ↔ `QuantityService.php` の既存慣習に従う）
- 配置済み負荷: テナントの未完了・日付ありアイテム（Beaver由来かどうかを問わない）を、`prep_date || due_date` を終端とする後ろ向き配分（`QuantityEngine.calculateVolume` と同一規則）で日別合計する。過去日に配分された分は今日に繰り越す
- 未配置プール（EDF対象）:
  - 各Beaverリンクの `unplaced`（締切 = `source_delivery_date`、なければYoukanプロジェクトの `due_date`、どちらもなければ締切なし）
  - テナントの通常アイテムで日付なし・未完了・`estimated_minutes>0`・`someday`/`pending`/`cancelled` 以外（締切なし扱い。Beaverリンク配下の末端は §6 で計上済みのため二重に入れない）

### 7.2 アルゴリズム（EDF仮想充当）

1. 今日から地平線（全締切の最大値から必要分延長、上限365日）まで、日ごとの空き = `max(0, キャパ - 配置済み負荷)` を計算する
2. 未配置プールを締切昇順（締切なしは最後）に並べ、今日から前方詰めで空きへ仮想充当する
3. 各案件について、充当が締切日以内に完了するか（`feasible`）、完了する最早日（`earliest_completion_date`）、締切までに入り切らない分（`shortage_minutes`）、その案件までの充当で空きが尽きている日（`saturated_through`）を求める

- 結果は保存しない（毎回計算）
- Google外部予定（`external_events_cache`）はY1では配置済み負荷に含めない（既知の制限。現在連携失効中。将来拡張として本仕様に追記して対応する）

### 7.3 出力（案件ごと）

```json
{
  "external_project_id": 123,
  "feasible": false,
  "deadline": "2026-09-10",
  "required_minutes": 780,
  "placed_minutes": 300,
  "unplaced_minutes": 480,
  "shortage_minutes": 180,
  "earliest_completion_date": "2026-09-12",
  "saturated_through": "2026-09-05",
  "message": "9/10納期では3h不足（9/12なら入る）"
}
```

- `message` は結論優先の日本語1行（「入ります」／「9/10納期ではXh不足（M/dなら入る）」／締切なしは「納期未設定・残りXh」）
- 365日地平線でも入り切らない場合 `earliest_completion_date` はnull

## 8. API一覧（Y1で追加）

| メソッド | パス | 認証 | 概要 |
|:--|:--|:--|:--|
| POST | `/integrations/beaver/sync` | 共通認証＋対象テナント所属 | §5。差分/全件同期 |
| GET | `/integrations/beaver/overview` | 共通認証＋対象テナント所属 | 全リンク＋§6の負荷値＋§7の判定結果＋`last_synced_at`/`last_error`。ProjectRegistryScreen用 |
| POST | `/integrations/beaver/capacity-check` | api_token（B2＝Beaverサーバーから） | 単一案件の判定。**契約の正本: `docs/SPEC/R-153_capacity_check_api_contract.md`** |

capacity-checkは判定前に対象案件をBeaver単体GET（`/integrations/youkan/projects/{id}`）で再取得してから評価する（Beaver登録直後の判定を確実に最新化する。リンク未作成なら§5.2の規則で取り込みしてから評価）。

## 9. フロントエンド（最小統合）

- `ProjectRegistryScreen` のみ変更。専用画面は作らない
- 画面表示時: `POST /integrations/beaver/sync`（diff・force=false。クールダウン中はスキップされる）→ `GET /integrations/beaver/overview`
- Beaver由来プロジェクト行に: 「Beaver」バッジ＋結論1行（例: `基準20h・納期9/10 → 入る` ／ `→ 3h不足（9/12なら入る）`）
- `sync_state='missing_upstream'` は「Beaver側から消えています・要確認」、`source_status='キャンセル'` は「Beaverでキャンセル・要確認」を表示（自動アーカイブしない）
- 「今すぐ同期」ボタン（full・force=true）＋前回同期時刻表示。同期失敗時は「同期できませんでした（前回同期: X）」
- `.env` 未設定（503）の場合はBeaver関連UIを一切出さない（既存プロジェクト一覧の挙動を変えない）

## 10. Y1の範囲外（Y2以降。実装しない）

- 見積内訳（work_packages）のサブプロジェクト化（B3待ち）
- 仮配置の永続化・`work_allocations` テーブル
- バッファ管理・声かけ
- テンプレート提案
- Beaver→Youkan push受信（B2）
- Google外部予定のシミュレーション算入
