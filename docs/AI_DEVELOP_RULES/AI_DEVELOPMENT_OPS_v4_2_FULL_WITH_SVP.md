# AI_DEVELOPMENT_OPS v4.2（完全版）
― Windows環境前提・自律AI開発の現場運用規約 ―

（前半部は既存 OPS v4.2 FULL と同一）


---

## 10. Smart Verification Protocol（SVP）の存在と位置づけ

本リポジトリ（または同一フォルダ）には  
**Smart_Verification.md** が存在する前提で運用する。

### 10.1 位置づけ
- Smart Verification Protocol（SVP）は  
  **ローカル開発サーバーの起動・再利用・検証を高速かつ安全に行うための補助プロトコル**
- SVP は以下に **完全従属** する
  - AI_DEVELOPMENT_CONSTITUTION
  - AI_DEVELOPMENT_PLAYBOOK
  - AI_DEVELOPMENT_OPS
- SVP は「どう起動・確認するか」を定義するが、
  **進んでよいか／仕様として正しいか** は判断しない

### 10.2 使用タイミング
- 実装フェーズ中の動作確認
- テストフェーズでの検証
- 手動操作テスト

### 10.3 運用ルール
- 開発サーバー起動時は、可能な限り **Smart_Verification.md に従う**
- `.dev_server_url` を用いた再利用チェックを優先し、
  無駄な再起動を避ける
- クライアント検証前には、
  必要に応じて状態初期化（localStorage 等）を行う

### 10.4 注意事項
- SVP は **効率化のための道具**であり、
  フェーズ判断・仕様判断・リリース判断を上書きしてはならない
- SVP の内容が本 OPS / PLAYBOOK / CONSTITUTION と矛盾した場合、
  **上位文書を必ず優先**する
