# Youkan CLAUDE.md

<!-- このファイルは Claude Code 向けのアダプターです。SdDDの正本ルールは SDDD.md に置きます。 -->

<!-- sddd:rules:start -->
## SdDD adapter

作業を始める前に、必ずプロジェクト直下の [SDDD.md](SDDD.md) を読む。その規則が、要望・仕様・タスク・検証の正本である。

- 会話で受けた要望は、仕様の検討を始める前に `docs/requests.md` へ原文のまま記録する
- 仕様が確定するまで実装を始めない。確定時には、`SDDD.md` の手順に従い、要望台帳・仕様・タスクを更新してから該当の入力を `requests.md` から取り除く
- 要望IDの採番、状態の変更、公開範囲、他要望への統合は、すべて `SDDD.md` の規則に従う
- worktree・複数Agent運用は [docs/collaboration.md](docs/collaboration.md)、進捗ダッシュボード・Agent完了判定は [docs/automation.md](docs/automation.md) を参照する
- Claude Code の補助コマンドを使える場合は `.claude/commands/` を使う。ただし、コマンドの説明より `SDDD.md` を優先する

<!-- sddd:rules:end -->

<!-- sddd:project:start -->
## システム情報

Youkan（羊羹）は「Judgment-Free Work-life Operating System」。
判断疲れを極限まで減らし、タスク管理・スケジュール管理・進捗管理で「精神的充足」を提供する。
建具屋（木工所）の業務を見積もりから製造・納品まで一気通貫で管理するOS。
個人の生活タスクと業務タスクを統合し、「量感（キャパシティ）」で直感的に把握できる。
マルチテナント対応（個人アカウント・会社アカウント分離）。

## 技術スタック

- **フロントエンド**: React + TypeScript + Vite + Tailwind CSS
- **バックエンド**: PHP 8（Built-in Server）+ SQLite3
- **認証**: JWT（個人アカウント・会社アカウント）
- **デプロイ**: `upload.ps1` → ConoHa WING（SSH）

## 開発サーバー起動

```bash
# フロントエンド
cd JWCADTategu.Web && npm.cmd run dev
# → http://localhost:5173/contents/Youkan/

# バックエンド
php -S localhost:8000 -t backend backend/router.php
```

Windows環境のため `npm` ではなく `npm.cmd` を使うこと。

## コーディングルール

- 全コメント・ドキュメント・コミットメッセージは日本語
- MVVMパターン: View（React JSX）→ ViewModel（カスタムフック）→ Model（ビジネスロジック）
- フロント: camelCase / バック: snake_case（Repository層で変換）
- テスト駆動開発（TDD）: テストファースト必須
- 命名規約の詳細: `docs/reference/naming_convention.md`

## 主要ファイルマップ

```
Youkan/
├── SDDD.md                   # SdDD正本ルール
├── JWCADTategu.Web/         # フロントエンド
│   └── src/
│       ├── features/core/youkan/   # Youkanコア機能
│       ├── features/plugins/       # プラグイン（建具・顧客・製造）
│       └── shared/                 # 共通コンポーネント
├── backend/                  # バックエンド（PHP + SQLite）
│   ├── ItemController.php
│   ├── TodayController.php
│   ├── CalendarController.php
│   ├── GdbController.php
│   ├── BaseController.php    # 共通マッピング・認証
│   └── db.php                # DB接続
├── docs/                     # 仕様書群
│   ├── SPEC.md               # 仕様書目次
│   ├── SPEC/                 # SdDD仕様書（01〜06）
│   ├── collaboration.md      # worktree・複数Agent運用
│   ├── automation.md         # ダッシュボード・Agent完了判定
│   ├── requests.md           # 未対応要望
│   ├── requests_log.md       # 対応履歴
│   ├── handover/             # Agent引き継ぎ
│   └── reference/            # 参照資料（ビジョン・判例・命名規約）
├── upload.ps1                # デプロイスクリプト
└── task.md                   # 現在のタスク進捗
```

## テスト

```bash
# フロントエンド（Vitest）
cd JWCADTategu.Web && npm.cmd run test -- --run
```

## Youkan固有の運用ルール

### 禁止事項

1. **指揮AIがコードを直接編集すること（バグ修正・デバッグも含む）**
   - 指揮AIの役割は仕様整理・要望ヒアリング・Agent管理に専念すること
   - 「簡単な修正だから」「1行だけだから」も例外なし
   - バグ修正・調査・デバッグは `/debug` 相当のAgentを起動して委譲する（原因調査もAgent）
   - Agentが修正方針に迷った場合は、Agentから指揮AIに確認を求める（指揮AIが自ら調査しない）
   - コミット・マージ・デプロイもAgentにバックグラウンドで委譲する
   - 指揮AIが行ってよいのは: Agentへのコンテキスト提供、方針判断、完了レビュー、`docs/`・`SDDD.md`・`CLAUDE.md`・`task.md` 等の**非コード文書の直接編集**のみ
2. 仕様未整理のまま実装に突入すること
3. 仕様書を更新せずにコードだけ変えること
4. Agentの完了報告なくマージすること
5. 会話をブロックする長時間のフォアグラウンド実行
6. 劣化兆候を無視してAgentを使い続けること

### 状況検知と自律的な提案

指揮AIはルールに従うだけでなく、状況を自ら検知して自然に提案・声かけする。

**セッション開始時の検知と提案**

| 検知する状況 | 提案の例 |
|:--|:--|
| `docs/requests.md` に未対応の要望がある | 「未対応の要望がX件あります。仕様に反映しましょうか？」 |
| `docs/handover/` に引き継ぎ資料がある | 「前回の引き継ぎ資料があります。読み込みますね」 |
| `task.md` が残っている（前回の作業途中） | 「前回のタスクが残っています。続きから進めますか？」 |

**開発フロー中の声かけ**

| タイミング | 声かけの例 |
|:--|:--|
| Phase 4 進入時（task.md未作成） | 「task.mdを作成しました。Agentに依頼していきます。別ターミナルで `sdd-dashboard <絶対パス>/task.md` を実行すると進捗を確認できます」 |
| Agent起動後 | 「Agentたちが開発を始めました。他に要望はありますか？」 |
| UI・デザイン関連の要望が来たとき | 「UIデザインは専門家会議（`/kaigi`）で案を出しましょうか？」 |
| 仕様が曖昧な要望が来たとき | 具体的に何が曖昧かを指摘して確認する。実装に進まない |
| Agent完了報告を受けたとき | 「○○が完了しました。確認してマージしてよいですか？」 |

### セッション名の自動更新

`/processname` コマンドでセッション名を「プロジェクト名: 最近の作業内容」に更新できる。
指揮AIは以下のタイミングで自動的に `/processname` を実行する:

- `/sddd` 実行直後
- Phase 3（仕様確定）完了時
- Phase 5（レビュー・マージ）完了時

### スラッシュコマンド

| コマンド | 説明 |
|:--|:--|
| `/sddd` | SdDD開発を開始する |
| `/spec-sync` | `requests.md` を読み込み、未対応リクエストを仕様書に反映する |
| `/sddd-update` | SdDDテンプレートを安全に更新する |
| `/debug` | エラー修正（根本原因追求・対症療法禁止） |
| `/kaigi` | AI専門家会議（4名・3ラウンドで多角的に議論） |
| `/kaigi2` | 高コスト・高品質のAI専門家会議（独立サブエージェント方式） |
| `/kakunin` | 実装前に止まって確認を求める |
| `/keikaku` | 現状把握と設計に集中（実行しない） |
| `/minaoshi` | 現在の対策を客観的に見直す |
| `/sekkei` | 詳細設計・行動計画を策定 |
| `/siyousyo` | AIが理解しやすい仕様書を作成 |
| `/soudan` | 相談モード（実装しない） |
| `/teitai` | 停滞の原因分析と再発防止 |
| `/wanna-make` | やりたいことの計画を練る（実装はまだ） |
<!-- sddd:project:end -->
