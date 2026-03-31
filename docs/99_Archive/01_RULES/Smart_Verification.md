# Smart Verification Protocol (SVP) v3.0
**Target**: Development Environment Reliability & Diagnosis

## 概要
本プロトコルは、開発サーバーの「起動」を単なるコマンド実行ではなく、「環境診断・自動修復・検証を含む一連の保証プロセス」として再定義する。手順に従うことで、ポート競合や依存関係エラーによる手戻りを防ぎ、常に正常な開発環境を提供する。

## Protocol Flow

### Phase 1: Diagnosis (環境診断)
起動前に環境が健全であることを確認する。

1.  **Runtime Check**
    *   PHP (`php -v`) がパスに通っているか。バージョンは8.x以上か。
    *   Node.js (`node -v`) がパスに通っているか。
2.  **Port Availability Check**
    *   **Backend Port (8000)**: 使用中か確認。
    *   **Frontend Port (5173)**: 使用中か確認。
    *   *Action*: ポート使用中の場合、それが「ゾンビプロセス」か「他の重要プロセス」かを判定し、可能なら**Kill**する（またはユーザーに通知）。

### Phase 2: Launch & Heal (起動と自己修復)
診断結果に基づき、安全にサーバーを起動する。

1.  **Backend Launch**
    *   コマンド: `php -S 127.0.0.1:8000 -t backend`
    *   *Constraint*: 必ず `127.0.0.1` (IPv4) を明示的にバインドする。
    *   *Log*: 標準出力/エラー出力を監視可能な状態にする。
2.  **Frontend Launch**
    *   コマンド: `npm.cmd run dev`
    *   *Constraint*: Windows環境では必ず `.cmd` を付与する。

### Phase 3: Verification (起動検証)
「コマンドを打った」ではなく「アクセス可能になった」ことを以て起動完了とする。

1.  **Backend Health Check**
    *   `GET http://127.0.0.1:8000/health.php` を最大10秒間ポーリング。
    *   **Status 200** ＋ JSONレスポンス `{"status":"ok"}` の確認。
    *   *Failure*: タイムアウトした場合、直ちにサーバープロセスを停止し、ログを表示して終了。
2.  **Frontend Reachability**
    *   `GET http://localhost:5173` (HEAD) で接続確認。

### Phase 4: Ready (完了報告)
全ての検証をパスした場合のみ、開発者に制御を戻す。

*   **Output**:
    ```text
    ✅ SVP v3.0: Environment Ready
    ----------------------------------------
    Backend : http://127.0.0.1:8000 [OK]
    Frontend: http://localhost:5173 [OK]
    ----------------------------------------
    ```

## Implementation Rules (実装ルール)
このプロトコルを実装するスクリプト（例: `check_and_start.ps1`）は以下の要件を満たすこと。

1.  **Idempotency (冪等性)**: 既に正常に起動している場合は、二重起動せず「稼働中」と報告する。
2.  **Fail-Fast**: いずれかのフェーズで異常があれば、後続処理を行わずに即座にエラー原因を報告する。
3.  **Clean Exit**: ユーザーが終了 (`Ctrl+C`) した際、立ち上げた子プロセス（PHP, Vite）も確実に終了させる。

## 関連ファイル
- `backend/start-server.ps1`: バックエンド単体の起動・診断（SVP準拠）
- `start_server.bat`: レガシー互換用（SVPラッパーとして機能させることを推奨）
