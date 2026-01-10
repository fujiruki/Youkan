# Smart Verification Protocol (SVP) v2

本プロトコルは、ローカル検証における「無駄な再起動の回避」と「確実な接続」を目的とする。

## Phase 1: Check Reuse (再利用チェック)
1. **記録ファイルの確認**
   - プロジェクトルートの `.dev_server_url` を読み込む。
2. **Fail-Fast Discovery (生存確認)**
   - ファイル内URLへ `HEAD` リクエストを送信する。
   - **重要**: タイムアウトは **500ms** に設定する（待たずに即時判断するため）。
   - **応答あり (200 OK)** → サーバー稼働中。**Phase 3 (Client Reset) へスキップ**。
   - **応答なし / ファイル無し** → サーバー停止中。**Phase 2 (Launch) へ進む**。

## Phase 2: Host Launch (ホスト起動)
1. **監視付き起動**
   - 起動コマンド（`npm.cmd run start` 等）を実行する。
   - **重要**: バックグラウンドに投げっぱなしにせず、標準出力を監視できる状態で実行する。
2. **Launch & Listen (起動と待機)**
   - サーバーが出力する **構造化されたJSONシグナル** を待機する。
     ```json
     {"SVP_SIGNAL": {"status": "running", "port": 3000, "url": "http://localhost:3000"}}
     ```
   - このJSONをパースしてURLを確実に取得する。
3. **Persist (記録)**
   - 取得したURLを `.dev_server_url` に書き込む。

## Phase 3: Verify & Reset (検証とリセット)
1. **ブラウザ起動**
   - 確定したURLをブラウザで開く。
2. **Client-Side Reset (状態初期化)**
   - **重要**: 再利用したサーバーは汚れている（過去のデータが残っている）前提を持つ。
   - テストシナリオの冒頭で、必要に応じて **`localStorage.clear()`** や **`indexedDB.deleteDatabase()`** を実行し、クリーンな状態を作る。
3. **検証実行**
   - 所定のテストシナリオを実行する。
