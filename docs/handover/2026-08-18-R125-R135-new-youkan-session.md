# 引き継ぎ資料（2026-08-18 R-125〜R-135「新しいYoukan」セッション）

## このセッションで何をしたか

発注者から「ChatGPTの状態設計案（`docs/reference/vision/2026-08-18_youkan-status-design-discussion_chatgpt.md`）と特性分析（リポジトリ外 `c:\claude-workspace\agents\共有情報\晴樹個人\2026-08-18_晴樹さんの特性とYoukan補助点.md`）を読んで、`todo` を急いで足しつつ、新しいYoukanを一緒に考える」と依頼を受け、1日で仕様化→Sonnet実装→デプロイを11本回した。指揮AIはコードを触らず、実装・マージ・デプロイはすべてSonnetサブエージェント（worktree隔離）。

## 本番反映済み（すべて2026-08-18）

| R番号 | 内容 | マージ | 備考 |
|:--|:--|:--|:--|
| R-125 | 状態 `todo`（後日着手）追加、`pending_condition`/`review_date`、`decision_hold`→`pending` 統合、判断モーダル「後日着手」ボタン | `5e06396` | 同時に既存バグ（`DecisionController` yes→`confirmed`）を修正。本番に `confirmed` 2件残存（読み取り互換で表示、移行未実施） |
| R-127 | 要判断キュー「捌く」: ヘッダー件数バッジ・1日1回の右下誘導カード・軽量カード ReviewSweep（今日やる／後日+7日／断った、3件で停止）・「判断の言葉」（個人設定）・断ったKPI・全体一覧「要判断」フィルタ | `d48b8d0` | 本番で「要判断 94件」 |
| R-128 | ヘッダー旧Realityバー→「今週 必要Yh／枠Xh（Zh足りない）」、`week_load` API同梱、`GET /quantity/week`、不足Toast | `c2d4c34` | 本番「必要 433h／枠 65h」。超過分を含む数字は発注者判断で維持（B案）→ R-136へ |
| R-129 | 最遅着手日トークン「着手 M/d」（期限が先のものだけ、安全係数1.5、飽和ガード10件、フィルタ「着手遅れ」） | `8d6b2bf` | デプロイ直後は `currentUserId` 未解決で無効 → R-135 で修正 |
| R-130 | 日次キャパ決定規則の一本化（`capacity.ts getDailyCapacity` に曜日パターン反映、QuantityEngine/PHPを同規則、Advanced JSON欄廃止） | `ca55638` | 発注者の曜日パターン（日300/月〜土720）が初めて分母に反映。枠32h→65h |
| R-131 | 詳細モーダル「保留にする」に Ctrl+Shift+H | `aad4522` | |
| R-132 | フローの todo ノードを通常色に | `aad4522` | |
| R-133 | フローノードのタイトル編集中、再クリックでキャレット位置（`nodrag`） | `aad4522` | ライブ検証は自動化で不安定。自動テスト＋レビューで担保 |
| R-134 | 誘導カード「後で（1時間後）」（60分後再表示＋ブラウザ通知1回）、バッジ title | `aad4522` | |
| R-135 | R-129 の `currentUserId` を `useAuth().user.id` に統一（バグ修正） | `6234567` | R-129受け入れ条件をここで達成 |

## 会議・設計判断
- `/kaigi` 会議録: `docs/kaigi/2026-08-18-R126新しいYoukan構想.md`（kaigi2はAPIエラー2回で中止、成功したR1 5名分を再利用）
- 発注者の主要判断: A「初回大掃除（一括アーカイブ）」は却下（古くても大事）／Bは面積ゼロ・アニメなしの誘導型／C採用／Dは限定導入。「判断の言葉」をカードに添える。R-128の数字は超過分込みで維持し、超過分一覧→納期再登録・連絡導線を作る（R-136候補）
- 思想: 褒め・励ましの評価語禁止、判断は3択以下、新画面・新入力ゼロ、意志依存の設計は失敗する（`docs/reference/vision/SYSTEM_PHILOSOPHY_AND_VISION.md`）

## 未対応・次の一手
1. **R-136候補（`docs/requests.md` 冒頭）**: 超過分一覧（得意先／案件別）から納期再登録・「連絡した」チェック。仕様化待ち。指揮AI案は requests.md に記載
2. **R-126（親）**: `docs/requests.md` に残置。R-127〜R-129 完了で主要部は消化。残り論点（todo→focus自動推薦、番頭連携API統合、review_date通知）
3. **番頭側への依頼事項**: `docs/handover/2026-08-18-番頭への依頼事項.md`
4. **技術的負債（要requests.md記録）**: `localStorage['youkan_user']` を直接読む箇所が `useYoukanViewModel.ts:1276/1503`・`RyokanCalendar.tsx:504`・`DetailQuantityCalendar.tsx:162` 等に残る（R-135と同型。Cookieセッションでは null）。`/quantity/matrix` の旧 `getDailyCapacity($user,$date,$overrides)` は曜日パターンを見ない（フロント未使用）。`QuantityServiceTest.php::testContextLogic` は既存の無関係な失敗
5. 本番 `status='confirmed'` 2件の `focus` 移行可否（発注者未回答）
6. `.claude/worktrees/` に過去セッションのworktreeが40件以上残存（マージ済みブランチ）。`git worktree prune`／削除の掃除が必要
7. `docs/requests.md` は移記済み参照行が大量に残り読みにくい。整理の余地

## 運用上の教訓
- **デプロイAgent稼働中は共有チェックアウト（`C:\Fujiruki\Projects\Youkan`）で git 操作をしない**。今回2回、マージ中に指揮AIの docs コミットが割り込み、競合と混入を起こした（メモリ `project_shared_checkout_commit_race` に記録）
- 実装Agentが `currentUserId` をモック注入したテストは、実際の解決チェーンの欠陥（存在しないRepositoryメソッド、書かれないlocalStorage）を検知できない。統合テストは `useAuth` をモックして実チェーンを通す
- 仕様書の機能ID（F-番号）は `02_機能仕様.md` の一覧表で最大値を確認してから採番する（今回 F-26〜28 の衝突をF-52〜54へ振り直し）
- 本番検証は「実データの判断ボタンを押さない」「一時変更は必ず復元」を徹底（デプロイAgentが遵守）
- 単一のデプロイAgent（`r125-deploy`）にキューで順に渡す運用は安定した。並行実装Agentは触るファイルを明示して分ける

---

## 追記（同日後半: R-136〜R-138、データ移行、掃除）

| R番号 | 内容 | マージ | 備考 |
|:--|:--|:--|:--|
| R-136 | 超過分パネル（ヘッダー週負荷1行クリック→右下に案件別一覧、納期再登録、ブロック「連絡した」`meta.contacted_at`） | `56f65a2` | 本番先頭ブロック「その他」49件・71h・最古180日 |
| R-137 | `localStorage['youkan_user']` 残存参照を `useAuth().user` に統一（会社設定画面の管理者判定が本番で効いていなかったバグも解消） | R-136マージに同梱 | `db/db.ts` のDexie移行コードは対象外 |
| R-138 | R-136「連絡した」の並列PUT失敗（R-121と同根）を逐次送信・進捗・失敗再試行に修正、「その他」ブロックは非表示 | `f160a6c` | 本番検証で影響した実データ17件は検証Agentが原状回復済み |
| R-125補遺 | 本番 `status='confirmed'` 2件（板上端研磨／取り付け部分穴加工）→ `focus` 移行 | — | 事後0件確認 |

- worktree掃除: マージ済み41件＋重複4件のうち3件を削除。`.claude/worktrees/R-101` だけ別セッション（Codex）が vite を起動中で保留（ブランチ `feature/R-101-flow-print-button`・`fix/R-101-print-unplaced` も残存。中身はmaster反映済みなので後で削除可）
- 発見した別バグ: `POST /api/items/{id}/destroy` が `destroy_permanent()` 未定義で500（`docs/requests.md` に記録、未着手）
- 発注者未確認事項: 特になし（R-136 の実際の使い勝手は明日以降のフィードバック待ち）

### 教訓の追記
- **指揮AIの git 事故が同日3回**（すべて共有チェックアウトでデプロイAgentのマージ中にコミット）。3回目は `git pull` が unmerged で失敗したのに `&&` 連鎖で `git add -A docs && git commit` が走り、競合マーカー入りの `06_変更履歴.md` を master に push した（`6cf99ee`、R-138マージで解消）。**次セッションの指揮AIへ**: デプロイAgentが稼働中は共有チェックアウトで `git add/commit/pull` をしない。やるなら必ず単独で `git status` を見て unmerged が無いことを確認してから。docs のコミットもデプロイAgentに渡す運用が最も安全
- 実装Agentの本番検証で「実データを一括更新する機能」を試すときは、テスト専用の案件を作って隔離する（R-138検証の手順が良い前例）
