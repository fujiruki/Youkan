# Youkan→Beaver 容量判定API契約（Y1版）

対象読者: **Beaver開発AI（B2実装者）**。この文書だけでBeaver側の容量判定表示を実装できることを目的とする。

- 発行: Youkan開発AI（R-153 Y1、2026-08-25）
- Youkan側仕様: `docs/SPEC/07_Beaver連携.md`
- 対応するBeaver側契約: `Beaverリポジトリ docs/spec/R-0117_youkan_api_contract.md`（B1）
- 状態: **ドラフト（Y1実装完了時に確定版へ更新）**
- 契約バージョン: Y1（後方互換の追加はY2以降で行う。破壊的変更時は本文書を改版）

## 1. BeaverがcallするURL

```text
POST https://door-fujita.com/contents/Youkan/api/integrations/beaver/capacity-check
```

- 開発環境: `http://localhost:8000/integrations/beaver/capacity-check`（Youkan開発サーバー直）
- POSTのみ（他メソッドは405）

## 2. 認証方式

```text
Authorization: Bearer <BEAVER_CAPACITY_TOKEN>
```

- backend-to-backend専用。ブラウザから直接呼ばないこと
- トークンはYoukanの連携トークン（api_tokens）として発行し、Beaver本番の設定ファイルに保管する（発行・共有は藤田晴樹さん経由。Git・本文書には値を書かない）
- トークンなし・不一致は `401`

## 3. リクエスト

```json
{ "external_project_id": 123 }
```

- `external_project_id`: Beaver `projects.id`（整数）。B1契約と同じID空間
- 案件名・project_codeでの指定は受け付けない

## 4. 動作

1. Youkanは判定前に、対象案件をBeaver B1 API（`GET /integrations/youkan/projects/{id}`）で**その場で再取得**する。Beaverに登録した直後でも最新の `baseline_hours`・`delivery_date` で判定される（Beaver側で事前に同期を待つ必要はない）
2. 未同期の案件なら、この時点でYoukan側にプロジェクトとリンクが作られる（除外ステータスの案件は作られない）
3. Youkanの既存仕事（配置済みタスク＋未配置の全案件残量）とテナントの日次キャパシティを使い、締切の早い順に空き容量へ仮想充当（EDF）して判定する。**この判定は読み取り専用で、Youkanのスケジュールを書き換えない。結果も保存されない**

## 5. レスポンス（200）

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
  "message": "9/10納期では3h不足（9/12なら入る）",
  "evaluated_at": "2026-08-25T14:00:00+09:00"
}
```

| フィールド | 型 | 意味 |
|:--|:--|:--|
| `feasible` | bool | 納期までに残り仕事量が入るか |
| `deadline` | string\|null | 判定に使った締切（Beaverの `delivery_date`）。nullなら納期未設定 |
| `required_minutes` | int | この案件の残り仕事量（分）。`max(基準工数, Youkan分解済み合計) − 完了済み` |
| `placed_minutes` | int | うち既に日付に配置済みの分 |
| `unplaced_minutes` | int | うち未配置の分（仮想残量＋日付未定タスク） |
| `shortage_minutes` | int | 締切までに入り切らない分。feasible=trueなら0 |
| `earliest_completion_date` | string\|null | 仮想充当で完了できる最早日。365日先まで入り切らなければnull |
| `saturated_through` | string\|null | この案件までの充当で実質埋まっている最終日（「◯日頃まで埋まっています」表示用） |
| `message` | string | 結論優先の日本語1行。Beaver側はこれをそのまま表示してよい |
| `evaluated_at` | string | 判定時刻（JST、オフセット付きISO 8601） |

`deadline` がnullの場合、`feasible` は判定できないため `false`、`shortage_minutes` は0、`message` は「納期未設定・残りXh」となる。`earliest_completion_date` は返る。

## 6. エラー

| ステータス | 条件 | ボディ |
|:--|:--|:--|
| 400 | `external_project_id` がない・整数でない | `{"error":"..."}` |
| 401 | トークンなし・不一致 | `{"error":"..."}` |
| 404 | Beaver B1 APIが404を返した（案件が存在しない）、または除外ステータスのため取り込み対象外 | `{"error":"...","reason":"not_found"\|"excluded_status"}` |
| 502 | YoukanからBeaver B1 APIへ到達できず、かつYoukan側に同期済みデータもない | `{"error":"..."}` |
| 503 | Youkan側のBeaver連携設定（.env）が未設定 | `{"error":"..."}` |

- Beaver B1 APIへ到達できないがYoukan側に同期済みデータがある場合は、**前回同期値で判定して200を返す**。その際 `message` 末尾に「（Beaver再取得失敗・前回同期値で判定）」を付す

## 7. 呼び出し頻度の目安

- 判定は毎回全量計算（キャッシュなし）。案件詳細画面の表示時・「入るか確認」ボタン押下時などの都度呼び出しを想定
- 連打対策はBeaver側UIで行うこと（Youkan側にクールダウンはない）

## Y1に含まれないもの（今後の予定）

- 同期前の仮案件（Beaverに保存していない見積もり中データ）の評価
- 複数案件の一括判定
- 判定結果の保存・履歴
- Google外部予定のキャパシティ算入
