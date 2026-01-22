# AI会議議事録: 製造業向け見積・原価・売上管理機能の設計

**Date**: 2026-01-22
**Theme**: Manufacturing Cost & Sales Model Design
**Participants**: PM (Facilitator), Tech Lead, UX Designer, Domain Expert (Factory)

## 0. 背景 (Context)
Phase 4において、単なるタスク管理を超えた「製造業としての計数管理（金勘定）」機能を実装する。
ユーザーからの詳細な要望 (`20260118見積売上の希望.md`) により、極めて具体的な要件が提示されている。

### ユーザー要件の要約
1. **見積・売上の一元管理とステータス遷移**:
   - 見積 → 売上（受注）→ 請求 という流れ。
   - 「見積から売上に引用（コピー）」することでレコードを作成。
   - レコードは独立し、片方の変更が他方に影響しない（スナップショット）。
2. **原価積算と売値決定**:
   - 材料費、金物、労務費、時間を積み上げて原価を算出。
   - 指定した「掛率」で売値を算出・固定。原価が変動しても売値は勝手に変わらない。
   - 粗利・利益率はリアルタイム表示。
3. **マスタ管理**:
   - 板材、金物、仕入先の管理。
4. **木材計算**:
   - 縦×横×長さ×立米単価 での都度計算機能。
5. **予実管理**:
   - 実際にかかった時間と比較。

## 1. 議論 (Discussion)

### 議題1: データモデル (Schema Design)

**Tech Lead**:
既存の `items` テーブルはタスク管理用だ。これに見積機能を詰め込むのは無理がある。
見積書、請求書といった「帳票 (Document)」を表す新しいエンティティが必要だね。

**Domain Expert**:
そうだね。「案件 (Project)」の中に、複数の「帳票 (Document)」がぶら下がる形が自然だ。
- Project A
  - Document 1: 初回見積 (Estimate)
  - Document 2: 変更見積 (Estimate)
  - Document 3: 最終売上伝票 (Sales)
  - Document 4: 請求書 (Invoice)

**PM**:
ユーザーは「見積と売上のデータベースは同一」と言っていた。これは `documents` テーブルひとつで、`type` カラムで区別するという意味で捉えていいかな？

**Tech Lead**:
その通り。「コピーして別レコードを作る」という要件とも合致する。
では、構成案を出すよ。

#### Schema Proposal:
1. **`documents` (Header)**
   - `id`: UUID
   - `project_id`: 紐付く案件
   - `type`: 'estimate', 'sales', 'invoice'
   - `status`: 'draft', 'sent', 'approved', 'paid'
   - `issue_date`: 発行日
   - `total_amount`: 税込合計
   - `tax_rate`: 税率
   - `snapshot_json`: 顧客情報や自社情報など、当時固定すべき情報
2. **`document_items` (Rows/Details)**
   - `id`: UUID
   - `document_id`: FK
   - `name`: 品名（「建具A」など）
   - `unit_price`: 単価（売値）
   - `quantity`: 数量
   - `cost_detail_json`: 原価計算の内訳（材料費、労務費、掛率など）
3. **`masters` (Materials, Hardwares)**
   - 専用テーブルを作るか、JSONで簡易管理するか。ユーザーは画像も登録したいと言っている。
   - 一旦 `master_items` テーブルを作り、`category` で分けるのが柔軟性が高い。

### 議題2: 原価積算と「掛率」のロジック

**UX Designer**:
ここのUIが肝心だよ。「原価を変えても売値は変わらない」けど「再計算ボタンを押せば変わる」。この挙動を明確にしよう。

**Domain Expert**:
工務店や建具屋では「掛率（かけりつ）」商売が基本だ。
`原価 * (1 + 利益率)` ではない。通常は `定価 * 掛率` だが、今回は製造原価からの積み上げだから、`原価 / 原価率` (= 売価) という計算になるのかな？
いや、ユーザーは「掛率で売値を算出」と言っている。`原価 * 掛率` (例: 1.2倍) なのか、`原価 / (1 - 利益率)` なのか。これは実装時に設定可能にしておこう。

**Tech Lead**:
データ構造としては、`cost_detail_json` に以下を持たせる。
```json
{
  "materials": [ ... ],
  "labor_cost": 5000,
  "labor_hours": 2,
  "total_cost": 15000,
  "markup_rate": 1.3, // 掛率
  "calculated_price": 19500, // 自動計算値
  "manual_price": 20000 // ユーザーが丸めた決定売価
}
```
そして、UI上で「再計算」を押したときだけ `manual_price` を更新する。それ以外は `total_cost` が変動しても `markup_rate` や `manual_price` は維持。これなら要件を満たせる。

### 議題3: 予実管理の統合

**PM**:
「実際に何時間かかったか」を入力して予実管理したいとのことだ。これは `items` (タスク) の実績時間と連動させるべきか？

**UX Designer**:
理想は連動だけど、見積もりの「建具一式」と、実際のタスク（「加工」「塗装」「取付」）は粒度が違うことが多い。
まずは `documents` (売上) 側に「実績原価」を入力できるフィールドを用意して、手動入力または「タスク選択して集計」ができるようにするのが現実的かな。

**Tech Lead**:
賛成。`sales` タイプのドキュメントには `actual_cost_json` を持たせよう。

## 2. 決定事項 (Decisions)

1. **テーブル構成**:
   - `documents` (見積・売上・請求ヘッダ)
   - `document_items` (明細行・原価内訳保持)
   - `master_items` (材料・金物マスタ)
2. **原価計算ロジック**:
   - 行ごとに `cost_detail_json` を持ち、そこに原価要素、掛率、決定売価を保存。
   - 「再計算アクション」でのみ売価を更新。
3. **マスタ機能**:
   - 画像URL対応。
4. **木材計算機能**:
   - モーダルUIで「縦・横・長さ・単価」を入力 → 材料費として明細の `cost_detail_json` に追記する機能として実装。

## 3. 次のステップ (Next Steps)
1. `check_items_schema.php` (既存) 等は使わず、新規マイグレーション `migrate_v11_manufacturing.php` を作成する。
2. APIエンドポイント `DocumentController.php` の作成。
3. Frontend: `DocumentEditor` コンポーネントの実装。

---
**Status**: Approved
**Author**: AntiGravity
