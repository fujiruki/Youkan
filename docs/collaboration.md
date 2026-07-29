# 並列・協業開発

## worktreeと並列Agent

仕様が確定した要望は、原則として `1要望ID / 1ブランチ / 1worktree / 1実装担当` で扱う。

- `requests.md`、`requests_log.md`、`spec/` は指揮役または文書担当が更新する
- 実装担当は、確定済みの仕様・要望ID・受け入れ条件を読み、専用ブランチでコードとテストを変更する
- 同じファイル、DBマイグレーション、共有設定、共通基盤を触る作業は並列にせず、統合担当を決める
- 引継書には要望ID、ブランチ、worktree、コミットSHA、テスト、未解決事項、次の一手を残す

## GitHub協業

GitHub Issueは、仕様確定後にチームが着手する作業単位として使う。生の要望は `requests.md`、現行仕様は `spec/`、要望の経緯と状態は `requests_log.md` を正本とする。

- 原則 `1要望ID / 1 Issue / 1実装PR`
- Issueに要望ID、仕様リンク、受け入れ条件、担当、実装タスクを記す
- PRに要望ID、仕様リンク、検証結果、影響範囲を記し、`Closes #番号` でIssueと結ぶ
- mainは直接pushせず、PR・CI・必要なレビューを通す
- 顧客情報・未公開戦略・生の会話を公開Issueへ転記しない

リポジトリが公開または外部共有される可能性がある場合、`requests.md` と `requests_log.md` にパスワード、トークン、秘密鍵、個人情報、契約上の秘匿情報、生の会話原文を置かない。必要なら、安全な保管先を参照する公開可能な要約だけを残す。

---

## Youkan固有: Agent運用ルール

### タスク割り振りの2原則

1. **機能スコープで分割する** — レイヤー（フロント/バック）ではなく機能で切る。1つの機能に関わるフロント・バック・API・DBは同じAgentが担当する
2. **コンテキストを持つAgentに優先的に振る** — 新しいタスクが来たとき、関連するコードや仕様を既に読み込んでいるAgentに振る。該当するAgentがいなければ新しいAgentを起動する

### 生存方針

Agentは機能完成後も解放しない。デバッグ・追加修正も同じAgentに任せる。

### 劣化監視

以下の兆候が2つ以上出たら引き継ぎを提案する。最終判断は発注者。

- 同じミスを2回以上繰り返す
- 指示した内容を漏らす・忘れる
- 修正が場当たり的になる
- 関係ないファイルを触り始める
- 応答が冗長になる・同じ説明を繰り返す

### 引き継ぎ手順

1. 指揮AIが引き継ぎを提案→発注者が承認
2. 劣化Agentが `docs/handover/` に引き継ぎ資料を作成
3. Agent解放→新Agent起動（引き継ぎ資料 + 該当specを読む）

## Youkan固有: 並列起動時のworktree分離（恒久ルール）

複数 Agent を並列起動する場合、互いの git 操作（`git checkout` 等）で `stash` が混入したり未コミット変更が他ブランチに紛れ込む事故が起きる。これを防ぐため:

1. **`isolation: "worktree"` を必ず指定する**
   - 各 Agent ツール呼び出しに `isolation: "worktree"` を渡す
   - 各 Agent は独立した git worktree（`.claude/worktrees/<name>/`）で作業し、互いに干渉しない
   - 変更がない Agent の worktree は完了時に自動削除される
2. **Agent prompt に worktree 情報の返却を明示**
   - 完了報告には worktree path とブランチ名を含めるよう指示する
3. **指揮 AI 自身は `git checkout` でブランチ切替しない**
   - ブランチ切替は Agent の責務。指揮 AI は worktree 経由でファイルを参照するか、現在のブランチで読み取りに留める
4. **`master` へのマージも worktree で別 Agent に委譲する**
   - 「マージ Agent」を立て、worktree で `git merge` → push まで実行させる
5. **`.gitignore` に `.claude/worktrees/` を追加**しておく（worktree ディレクトリが untracked として現れない様に）
6. **`.worktreeinclude` を整備**（`.env`, `backend/jbwos.sqlite` 等の untracked かつ必要なファイルを worktree に自動コピー）
7. **Agent prompt の最初の git 操作に `git fetch && git checkout -b <branch> master` を明示する**（必須）
   - worktree が起動時に取り込む base スナップショットは過去の master を指していることがある（指揮 AI が直前にコミットした場合特に）
   - これを無視して `git checkout -b ...` だけだと、ブランチ全体が R-XXX を巻き戻す巨大差分（+45万行）になりマージ不能になる
   - **実際に発生した事故**（2026-06-04）: R-038 Agent の base が古く、`master` の `.gitignore` 整理コミット（`b436236`）を巻き戻す状態で実装してしまった。リカバリに cherry-pick + 衝突解消の追加 Agent 1 回分のコストが発生した
8. **指揮 AI 側の自衛**
   - Agent 起動の前後で `pwd` と `git rev-parse --abbrev-ref HEAD` を確認する。Bash ツールの cwd が Agent worktree 内に勝手に移ることがあるため、コマンドは `cd /c/Fujiruki/Projects/Youkan && ...` を先頭に付けて固定
   - メイン作業ツリーの HEAD が Agent worktree のブランチに化けていたら（`On branch feature/R-XXX` と出る）即 master に戻す
9. **マージ後の差分検査を必須化**
   - Agent 完了報告を受け取ったら、master マージ前に `git diff --stat master..<branch>` で**全体行数**を確認する
   - 期待行数の 10 倍以上、または `*.sqlite` / `*.log` / `tsbuildinfo` などの巻き戻しが混入していたら、**マージせずに cherry-pick リカバリに切り替える**

参考: https://code.claude.com/docs/en/worktrees
