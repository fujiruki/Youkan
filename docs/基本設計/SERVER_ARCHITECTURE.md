# サーバーサイド移行 基本設計書

## 1. システム構成概要
本システムは、クライアント（ブラウザ）とサーバー（ConoHa WING）が連携するハイブリッド構成へ移行する。
「AIによる自律デバッグの容易性」と「運用コストの低減」を最優先事項とし、以下の構成を採用する。

### 1.1 技術スタック
| レイヤー | 技術 | 選定理由 |
| :--- | :--- | :--- |
| **Frontend** | React (TypeScript) | 既存資産の活用。SPAとしてビルドし静的配信。 |
| **Backend** | PHP 8.x | ConoHa WING標準。プロセス管理不要で安定稼働。 |
| **Framework** | Slim 4 (または同等の軽量ルーター) | 学習コスト低、ファイル数少、REST API構築に最適。 |
| **Database** | SQLite 3 | サーバー設定不要。ファイルベースでAIが管理・移行しやすい。 |
| **Protocol** | RESTful API (JSON) | シンプルでデバッグ容易。 |

### 1.2 アーキテクチャ図
```mermaid
graph LR
    User[ユーザー] --> Browser[ブラウザ (React)]
    subgraph "ConoHa WING (Shared Hosting)"
        Browser -- HTTP/JSON --> API[PHP API Gateway]
        API -- Read/Write --> SQLite[(SQLite DB)]
        API -- Log --> ErrorLog[Error Log (JSON)]
    end
    AI[AI Agent] -- Debug API --> API
```

## 2. データ保存方針
### 2.1 データモデル
- **Items**: GDB（判断ボード）のタスクデータ。
- **Doors**: 建具データ（現行のTategu Coreデータ）。
- **Logs**: システムエラーおよびクライアントエラーのログ。

### 2.2 セキュリティ
- **DBファイル保護**: `.sqlite` ファイルは Web公開領域外（または `.htaccess` でアクセス拒否）に配置する。
- **デバッグAPI保護**: AI専用エンドポイントには IP制限 または 共有シークレットキー認証 を設ける。

## 3. 運用・保守方針
- **デプロイ**: FTP/SFTP または Git Pull による更新。
- **バックアップ**: SQLiteファイル (`jbwos.sqlite`) の定期ダウンロードのみで完了。
- **AIデバッグ**: `GET /api/debug/logs` により、サーバー内部のエラーをJSON形式で取得可能にする。
