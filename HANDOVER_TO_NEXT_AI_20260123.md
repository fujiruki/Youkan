# HANDOVER TO NEXT AI (2026-01-23)

## 1. プロジェクト状況サマリ
現在、「Phase 3.5: Security Hardening & Architecture Redesign」の段階にあります。
直近で重要なアーキテクチャ変更（マルチテナント・プラグイン構造）の合意形成を行い、ログイン周りの不具合修正を完了しました。

### 直近の成果
*   **Fix**: ログイン後のリダイレクト不具合修正（`window.location.reload()`）
*   **Fix**: API Base URLのサブディレクトリ解決ロジック修正（`AuthService` 経由への統一）
*   **Design**: マルチテナント・プラグインアーキテクチャの定義（`docs/02_Architecture/Multi_Tenant_Plugin_Architecture.md`）

---

## 2. アーキテクチャ重要変更点
**「個人 (User)」と「会社 (Tenant)」の関係を再定義しました。**

1.  **分離と共有の哲学**:
    *   **Data Isolation**: 会社Aのデータは会社Bから絶対に見えない。
    *   **Volume Sharing**: ユーザーのリソース（忙しさ）だけは、テナントを跨いで共有される。「A社で忙しい」ことはB社にも「詳細不明のブロック」として伝わり、無茶なアサインを防ぐ（詳細は `docs/02_Architecture/Multi_Tenant_Plugin_Architecture.md` 参照）。
2.  **Plugin戦略**:
    *   プラグイン（Manufacturing, Tateguなど）は**Tenant単位**でON/OFFする。
    *   Userは「今どの会社としてログインしているか」によって利用可能な機能が変わる。

---

## 3. 実装済み機能（現状）

### Backend (PHP/SQLite)
*   **Auth**: JWTベース認証。`tenants`, `users` テーブル実装済み（ただしスキーマ拡張が必要）。
*   **Controllers**: `ItemController`, `ProjectController`, `LogController` など。
*   **Security**: `tenant_id` にるスコープ制御を実装中（`migarate_v9` 等でログ周りは対応済みだが、全体への適用は道半ば）。

### Frontend (React/Vite)
*   **Stack**: React, TypeScript, TailwindCSS.
*   **Routing**: サブディレクトリ `/contents/TateguDesignStudio/` での動作を前提。
*   **Board**: JBWOS Global Board (GDB) および Today's Decision 画面。
*   **Plugin UI**: `src/features/plugins/tategu` などに建具用コンポーネントがあるが、新しいアーキテクチャに合わせて整理が必要。

---

## 4. 次にやるべきこと（Next Actions）

### A. 会社設定機能 (Company Settings) の実装
**優先度: 高**
新しいアーキテクチャの基盤となる「会社設定」を実装してください。
詳細は `docs/05_Roadmap_and_Backlog/Implementation_Plan_CompanySettings.md` にあります。

1.  **Frontend**: `SettingsScreen` をタブ化し、「基本情報」「メンバー」「セキュリティ」を実装。
2.  **Backend**: `tenants` テーブルにカラム（住所、インボイス等）を追加するマイグレーション作成。

### B. マルチテナント対応の強化
1.  **Schema**: `tenant_members` テーブルを作成し、UserとTenantを多対多で紐付ける。
2.  **Login Flow**: ログイン後に「テナント選択」または「デフォルトテナントへの自動遷移」を実装。

### C. プラグイン基盤の整備
1.  `TenantConfig` (機能フラグ) の実装。
2.  Settings画面に「プラグイン」タブを作成（将来用）。

---

## 5. 思想的ガイドライン（Constitution）
*   **休める勇気**: システムはユーザーを監視するためではなく、「今日はこれで十分」と言わせてあげるためにある。
*   **量感 (Volume)**: 数字で管理せず、色の濃さや圧力で忙しさを伝える。
*   **Deep Context**: ユーザーの言葉のニュアンスを勝手に要約せず、深く理解すること。

## 6. 重要ファイル・ドキュメント
*   `docs/00_Vision/01_Philosophy_and_Concept.md`: JBWOSの憲法。
*   `docs/02_Architecture/Multi_Tenant_Plugin_Architecture.md`: **必読**。最新のアーキテクチャ設計。
*   `docs/05_Roadmap_and_Backlog/Implementation_Plan_CompanySettings.md`: 直近の実装計画。
*   `JWCADTategu.Web/src/api/client.ts`: API通信の核心。Base URL計算ロジックあり。
