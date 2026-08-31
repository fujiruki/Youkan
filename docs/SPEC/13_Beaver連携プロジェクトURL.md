# 13. Beaver連携（案件→Youkanプロジェクトの直リンク解決API）

- 要望: R-0160（`docs/requests_log.md`）
- 前提: Y1（`docs/SPEC/07_Beaver連携.md`）・Y2（`docs/SPEC/08_Beaver連携Y2.md`）は無変更。既存の`external_project_links`テーブル・`IntegrationController::requireBeaverService()`認証パターンをそのまま利用する追加APIのみの仕様
- 発注元: Beaverリポジトリ（`fujiruki/Beaver docs/requests.md` R-0130）。Beaver側の消費仕様は`fujiruki/Beaver docs/spec/R-0130_youkan_link_button.md`（Beaver側で別途作成）

## 1. 背景・原文

Beaver側で受けた要望（藤田晴樹さん、2026-08-31、Beaver `docs/requests.md` R-0130より転記）:

> 案件編集画面から、この案件のYoukanで見るボタンが欲しい。案件一覧の各行にも欲しい。

R-153（Y1）検討時に同種要望が一度出たが、「YoukanプロジェクトURL/IDをBeaverへ返す契約が無い」ため見送られていた。Y2完了後の今回、藤田晴樹さんの判断で「Youkan側に新規APIを追加して正確な遷移を実装する」方針が確定した。

## 2. 目的

Beaverの案件ID（`external_project_id`）から、対応するYoukanプロジェクトを直接開くために必要な情報（Youkan内部ID・表示名・テナントID）を返す、読み取り専用のルックアップAPIを追加する。

このAPIは同期のトリガーではない。既に`external_project_links`にリンクが存在する案件のみ情報を返す（未同期ならBeaver側はボタンを出さない、または「未連携」と案内する）。

## 3. API

```text
GET /integrations/beaver/project-link/{external_project_id}
```

- 開発環境: `http://localhost:8000/integrations/beaver/project-link/{external_project_id}`
- 認証: 既存`requireBeaverService()`と同じ（`.env`未設定→503、`BaseController::authenticate()`＝JWT／共有セッション／api_token、対象テナント未所属→403）。Beaver側は既存の`BEAVER_CAPACITY_TOKEN`（capacity-checkと同一トークン）をそのまま使う。**新しいトークンは発行しない**
- `{external_project_id}`: 整数以外は400
- GET以外は405

### 3.1 レスポンス（200）

```json
{
  "external_project_id": 123,
  "youkan_project_id": "prj-6a908c3499e595",
  "title": "○○様邸 建具工事",
  "tenant_id": "t_697b2af180467"
}
```

- `external_project_links`テーブルから`(tenant_id, source_system='beaver', external_project_id)`で1件引く（Y1の照合キーと同一）
- `sync_state`は問わない（`missing_upstream`でも、Youkanプロジェクト自体は存在するため200で返す。表示上の「要確認」判断はBeaver側の責務ではなくYoukan側UIの既存領分のため、本APIはリンクの存在有無のみを見る）
- `youkan_project_id`は`items.id`そのもの（`external_project_links.youkan_project_id`列の値をそのまま返す）
- `title`はYoukan側の現在の`items.title`（Beaver由来の`source_name`ではなく、Youkan側で改名されていればその値。フロントの`?title=`パラメータは表示用ヒントに過ぎないため、Youkanの正本値を返す）

### 3.2 エラー

| ステータス | 条件 | ボディ |
|:--|:--|:--|
| 400 | `external_project_id`が整数でない | `{"error":"..."}` |
| 401 | トークンなし・不一致 | `{"error":"..."}` |
| 403 | トークンは有効だが対象テナント未所属 | `{"error":"..."}` |
| 404 | `external_project_links`にリンクが存在しない（未同期）、またはリンク先Youkanプロジェクトが`deleted_at IS NOT NULL`（`sync_state='target_missing'`） | `{"error":"...","reason":"not_found"}` |
| 405 | GET以外 | `{"error":"Method Not Allowed"}` |
| 503 | `.env`未設定 | `{"error":"..."}` |

## 4. 実装方針

- `IntegrationController::handleRequest()`に`preg_match('#^/beaver/project-link/(\d+)$#', ...)`分岐を追加
- `requireBeaverService()`を再利用（新規サービスクラス不要）。DB問い合わせは`BeaverSyncService`か`IntegrationController`内の小さなprivateメソッドで完結する規模（`SELECT youkan_project_id FROM external_project_links WHERE tenant_id=? AND source_system='beaver' AND external_project_id=?`→見つかったら`items`テーブルから`title`を引く）
- 新規テーブル・新規マイグレーション不要
- フロントエンド変更なし（本APIはBeaverサーバーから呼ばれるbackend-to-backend専用。Youkan自身のUIからは呼ばない）

## 5. 不変条件

1. 本APIは同期を発生させない（`external_project_links`への書き込みを一切行わない、純粋な読み取り）
2. Youkan側のトークン・DB設計・既存Y1/Y2ロジックには一切変更を加えない
3. 案件名・project_codeでの照合はしない（`external_project_id`のみ、Y1不変条件§1を継承）

## 6. 必須テスト

バックエンド（PHP）:
- [ ] リンクが存在する案件で200・正しい`youkan_project_id`/`title`/`tenant_id`が返る
- [ ] リンクが存在しない案件で404 `reason:not_found`
- [ ] `sync_state='missing_upstream'`のリンクでも200で返る（消えたことの判定はしない）
- [ ] `sync_state='target_missing'`（リンク先プロジェクトが削除済み）は404 `reason:not_found`
- [ ] `external_project_id`が整数でない（文字列等）は400
- [ ] トークンなし・不一致は401
- [ ] 対象テナント未所属のトークンは403
- [ ] `.env`未設定は503
- [ ] GET以外（POST等）は405
- [ ] 他テナントの`external_project_id`（同じ整数値だが別tenant_id）を誤って返さない（tenant_id条件の確認）
- [ ] Y1/Y2の既存テスト回帰（本API追加が既存エンドポイントに影響しないこと）

## 7. Y2以降の範囲外（今回は対応しない）

- 未同期案件に対する「今すぐ同期してリンクを作る」オンデマンドトリガー（Beaver側はリンクが無ければボタンを出さない、またはグレー表示にとどめる想定。将来必要になれば別要望として起票）
- `title`のURLエンコード・実際のFocus URL文字列組み立て（Beaver側の責務。本APIは構成要素のみ返す）
