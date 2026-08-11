---
description: 本番の改善要望フォーム（requests_sub.md）を読み、要望を取り入れて仕様化・実装・レビュー・マージ・本番デプロイまで一気通貫で進める
---

# /readyoubou — 要望を読んでデプロイまで

発注者から「要望を読んで取り入れてデプロイして」と言われたときの標準フロー。SdDD（`SDDD.md`）の手順に従い、指揮AIはコードを直接編集せず、実装・マージ・デプロイはすべてAgentへ委譲する。

## 1. 本番の改善要望フォームを読む

SSH経由で本番サーバーの `requests_sub.md` を取得する（発注者がアプリ内「改善要望を送る」ボタンから送信した生の要望ログ）。

```bash
ssh -o StrictHostKeyChecking=no -o ConnectTimeout=15 -p 8022 -i "C:\Fujiruki\Secret\key-2026-03-21-18-16-ConohaforAI.pem" c6924945@www1045.conoha.ne.jp "cat public_html/door-fujita.com/contents/Youkan/backend/data/requests_sub.md 2>&1"
```

画像添付がある要望（`![screenshot](requests_sub_uploads/xxx.png)` 形式）は `scp` でローカルへ取得し、Read ツールで内容を確認してから文脈を判断する。

```bash
scp -o StrictHostKeyChecking=no -P 8022 -i "C:\Fujiruki\Secret\key-2026-03-21-18-16-ConohaforAI.pem" "c6924945@www1045.conoha.ne.jp:public_html/door-fujita.com/contents/Youkan/backend/data/requests_sub_uploads/<ファイル名>" "<ローカル保存先>"
```

## 2. 既存の記録と突き合わせ、新規項目を特定する

`docs/requests.md`（未対応要望台帳）と `docs/requests_log.md`（対応履歴、最大R番号の確認用）を読み、`requests_sub.md` の項目のうちまだ記録されていない新規項目を洗い出す。

## 3. 発注者へ要約提示・優先度確認

新規項目が複数ある場合は、性質（バグ／UX改善／大型機能）と件数に応じて、AskUserQuestion で今回どこまで対応するか確認する。決めつけて全件着手しない。過去の実績パターン:
- 明確な優先度指定があれば従う（例:「フローチャートの動きを速くすることを優先」）
- 着手時期が明示された要望（例:「8/30以降」）は指定時期まで着手しない
- 小粒なバグ修正・低優先度UI要望は記録のみで様子見も選択肢に入れる

## 4. `docs/requests.md` へ原文のまま記録する（SdDD必須）

仕様検討前に必ず記録する。既存の記載パターン（`- **【優先度】**` 見出し＋原文引用）に倣う。

## 5. 対応するものは仕様化してR番号を採番する

- `docs/requests.md` と `docs/requests_log.md` を検索し最大R番号の次を採番する
- `docs/SPEC/02_機能仕様.md` に機能ID（F-番号）と仕様セクションを追記する
- `docs/requests_log.md` へ移記し、`docs/requests.md` からは「→ R-XXX として移記済み」の参照行に置き換える
- `task.md` に実装Agent向けのタスクセクションを追加する（対象ファイル・調査済みの手がかり・サブタスクチェックリスト・完了条件を明記。指揮AI自身が事前調査した内容があれば「実装Agentは再調査不要」として引き継ぐ）

## 6. 実装をAgentへ委譲する

- 各R番号ごとに `Agent`（`subagent_type: general-purpose`、`model: sonnet`、`isolation: worktree`、`run_in_background: true`）を起動する
- 最初のgit操作は必ず `git fetch && git checkout -b <ブランチ名> master` を明示する（base取り違え事故の防止）
- TDD必須（Red確認→実装→Green確認）、`docs/requests_log.md`・関連SPEC文書の更新もAgentに含める
- masterへのマージは行わせない（指揮AIのレビュー後に別途指示）
- パフォーマンス調査等、独立した機密性のないデバッグタスクはCodex（`codex:codex-rescue`）への委譲も検討する（Youkan CLAUDE.mdの振り分け基準に従う）
- 複数Agentが同じファイル（`docs/requests_log.md`・`task.md`・`docs/SPEC/*.md`など）を同時に編集するため、後続のマージで競合しうることを念頭に置く

## 7. 完了報告をレビューする

- Agentの完了報告を鵜呑みにせず、`git diff --stat`・実際のコード差分を読んで妥当性を確認する
- 実機検証が不十分（自動化ツールの制約等）な場合は、指摘して追加確認を依頼する。曖昧な報告は再調査を依頼してよい
- 問題があれば同じAgentへSendMessageで差し戻す（Agentは解放せず同じAgentに任せる）

## 8. masterへマージする

- レビュー承認後、実装したAgent自身にマージ・pushを指示する（`git fetch` → 最新masterへmerge/rebase → テストGreen確認 → `git push origin HEAD:master`）
- 元のAgentのtranscriptが失われている場合は、同内容で新規の「マージ専用Agent」を起動し、対象ブランチ名・コミットSHAを明示して依頼する
- 複数R番号を並行マージする場合、`docs/requests_log.md`・`task.md`・`docs/SPEC/*.md` の末尾追記が競合しやすい。コンフリクトはどちらか一方を選ばず**両方の内容を残す**よう明示指示する
- マージ後は指揮AI側のローカルmainリポジトリも `git pull`（ローカルに指揮AI自身の下書き編集が残っている場合はstash→pull→pop→手動でコンフリクト解消。Agent側の最終版を正とし、ローカル下書きの古い記述は破棄する）

## 9. 本番デプロイをAgentへ委譲する

`.claude/skills/deploy/SKILL.md` の手順（テスト→ビルド→`upload.ps1`→本番実機検証→記録）に従うAgentを起動する（メイン作業ディレクトリで実行、worktree isolation不要）。デプロイ対象のR番号・変更内容の要約をプロンプトに含め、実機検証では該当機能を実際に操作して確認するよう具体的な検証手順を指示する。

## 10. 発注者への報告

デプロイ完了後、対応したR番号・内容・本番検証結果を簡潔に報告する。今回対応しなかった項目（低優先度・時期指定あり等）がある場合はその旨も伝える。
