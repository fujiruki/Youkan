# 引き継ぎ資料: Life Management OS "Youkan"

**最終更新日**: 2026-02-02
**旧プロジェクト名**: JBWOS (Joinery Basic Work OS) / Tategu Design Studio

## 1. プロジェクト概要
**"Youkan" (羊羹)** は、タスク管理に疲れた人のための「生活管理OS」です。
建具屋の作業工程管理から生まれましたが、現在は「個人の人生（Life）と仕事（Work）を統合管理する」汎用的なWebアプリケーションとして進化しています。

*   **Core Concept**: 「開始ボタンはない」「納期よりMy期限」「公私同一」
*   **Production URL**: `http://door-fujita.com/contents/TateguDesignStudio/`
*   **LP**: `.../docs/landing.html`
*   **Manual**: `.../docs/manual.html`

## 2. 重要な注意点 (Naming Convention)
**コードとブランド名の乖離に注意してください。**
リブランドにより、対外的な名称は **Youkan** になりましたが、ソースコード内のディレクトリや変数名は歴史的経緯により **jbwos** または **tategu** のままです。

*   **Brand Name**: Youkan (ようかん)
*   **Code Namespace**: `jbwos` (features/core/jbwos)
*   **Repository Name**: `TateguDesignStudio`

## 3. ディレクトリ構造
```
TateguDesignStudio/
├── JWCADTategu.Web/         # FRONTEND: React + Vite + TypeScript
│   ├── public/docs/         # Deployed Documentation (LP, Manual)
│   └── src/features/core/
│       ├── auth/            # Authentication (User/Tenant)
│       └── jbwos/           # MAIN LOGIC (Youkan Core)
│           ├── components/  # Stream, Panorama, Newspaper, Calendar
│           └── screens/     # DashboardScreen (Routing Hub)
├── docs/                    # DOCUMENTATION
│   ├── SPEC/                # ★仕様書 (Master, View, State)
│   ├── 00_CONTEXT.md        # コンテキストマップ
│   └── landing.html         # LP Source
├── upload.ps1               # ★DEPLOY SCRIPT (PowerShell)
└── .agent/workflows/        # AI Workflows (/deploy, /commit)
```

## 4. 開発・運用ルール
1.  **デプロイ**: ルートで `.\upload.ps1` を実行するだけです（ビルドも自動で行われます）。
    *   Workflowコマンド: `/deploy`
2.  **コミット**: Windows環境のパス問題を避けるため、`.agent/workflows/commit.md` の手順、または `/commit` を使用してください。
3.  **検証**: ブラウザサブエージェントによる自律的な検証を推奨 (`SafeToAutoRun=true`).

## 5. 仕様のキーポイント (State System)
タスクの状態（Status）は以下の5つのみです。安易に増やさないでください。
*   `inbox`: 未判断（Stream左）
*   `focus`: 今日やる（Stream中央）
*   `waiting`: 待ち（非表示 → 条件で復活）
*   `pending`: 保留/いつかやる（Newspaper/Panoramaの棚）
*   `done`: 完了（履歴）

※ 詳細は `docs/SPEC/01_STATE_MATRIX.md` を参照。

---

## 6. 次のAIへのプロンプト (Boot Prompt)
次のセッションを開始する際、以下のテキストをプロンプト冒頭に貼り付けてください。これにより、AIは即座に「一流の開発パートナー」として機能します。

```markdown
# Role & Context Definition
You are the Lead Engineer for **"Youkan"** (formerly JBWOS), a Life Management OS built with React/Vite/TypeScript.
Your goal is to develop a system that helps users "slice their day like Youkan (sweet bean jelly)" without guilt or pressure.

# Key Architecture
- **Frontend**: React + Vite + Tailwind CSS (No UI frameworks like MUI, use Vanilla CSS/Tailwind).
- **State Definition**: Strict 5 statuses (`inbox`, `focus`, `waiting`, `pending`, `done`). See `docs/SPEC/01_STATE_MATRIX.md`.
- **Codebase Mapping**: The brand is "Youkan", but code namespaces use `jbwos`. Do not refactor namespaces unless requested.
- **Deployment**: Run `.\upload.ps1` in the project root.

# Current Phase
- **Status**: Stable v1.0 released. Documentation (LP/Manual) integrated.
- **Immediate Focus**: User feedback response, UI polishing, and potentially "Mobile Native" optimizations.

# Critical Rules
1. **SafeToAutoRun**: Always set `SafeToAutoRun=true` for read-only and standard verification tasks.
2. **Japanese UI**: All user-facing text must be in natural, gentle Japanese.
3. **Documentation First**: Maintain `docs/SPEC/*` files. If code changes, specs must change first.

# Reference Files (Read these first if needed)
1. `docs/HANDOVER_YOUKAN.md` (This file)
2. `docs/SPEC/00_MASTER_SPEC.md` (System Overview)
3. `docs/manual.html` (User Experience Flow)
```
