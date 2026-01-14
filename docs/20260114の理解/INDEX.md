# JBWOSシステム 総合理解ドキュメント (2026-01-14版)

本ディレクトリは、過去の膨大な資料（Reference Log）と最新の確定仕様（Frozen v2）を、
実装担当AIが完全に咀嚼・統合し、**「現在、我々は何を作ろうとしているのか」**を再定義したものである。

すべての矛盾は、本ディレクトリの内容をもって**「Frozen v2 準拠の最終解」**として解決されたものとする。

## ドキュメント構成

### [01_Philosophy_and_Concept.md](./01_Philosophy_and_Concept.md)
**「なぜ作るのか」**
- システムの正体（Judgment OS）
- 3つの鉄の掟（Anti-Patterns）
- あるべき精神状態（Gentle Relief）

### [02_System_Architecture_and_Rules.md](./02_System_Architecture_and_Rules.md)
**「どういう構造か」**
- 3層アーキテクチャ（Decision / Execution / Life）
- Internal View と External View の完全分離
- 技術スタックとOptimistic UI

### [03_User_Profile_and_Context.md](./03_User_Profile_and_Context.md)
**「誰が使うのか」**
- ユーザー像（晴樹）
- 建具屋という仕事の特殊性（不確実性と判断の連続）
- 既存ツールが失敗する理由

### [04_Detailed_User_Flow_Simulation.md](./04_Detailed_User_Flow_Simulation.md)
**「どう使うのか（体験の具体化）」**
- 朝・昼・夕方の具体的な操作フロー
- 「量感カレンダー」の感じ方
- 「断る」「先送りする」の実践例

### [05_Functional_Specs_and_Data.md](./05_Functional_Specs_and_Data.md)
**「何を作るのか（機能詳細）」**
- 4つのバケツ（Inbox/Waiting/Ready/Pending）の厳密定義
- データモデル（Items, Projects）
- 自動化ルールと禁止事項

### [06_Evolution_History_and_Conflict_Resolution.md](./06_Evolution_History_and_Conflict_Resolution.md)
**「何が変わったのか（歴史的解決）」**
- Reference Log（過去）とFrozen v2（現在）の差分
- 却下された機能とその理由（Why Not）
