# Plugin Externalization Strategy (プラグイン開発の外部化戦略)

将来的に「JBWOS Core開発チーム」と「各種プラグイン開発チーム（建具・家具など）」が分離して並走できるための、開発・テスト戦略です。

## 1. Separation of Concerns (責務の分離)

*   **Core Team**: 「汎用的なシステム」を作る。
    *   **Focus**: タスク管理、スケジュール、Manufacturing Bus（集計・同期ロジック）。
    *   **Constraint**: 特定の業種（建具など）の知識をCoreコードに混ぜない。「プラグインがなくてもシステムが落ちない」ことを保証する。
*   **Plugin Team**: 「専門的なロジック」を作る。
    *   **Focus**: 拾い出しUI(Manifest Editor)、専門計算ロジック、固有データの保存。
    *   **Constraint**: CoreのDBや内部ロジックを直接触らない。必ず定義された `Interface` (Contract) を通して会話する。

## 2. Testing Strategy (テスト戦略)

お互いの開発がブロックされないよう、テスト環境を分離します。

### A. Core Team Testing (Mock Plugin)
Coreチームは、建具プラグインの実物がなくてもテストできるよう、**「Mock Plugin (ダミー製造業)」** を開発用に使用します。

*   **Mock Plugin**: 
    *   最もシンプルな "Hello World" 的な製造業プラグイン。
    *   例えば「箱を作る」プラグイン。
    *   単純に「名前」「個数」を入力すると、固定の計算式で原価と時間を返す。
*   **Purpose**: 
    *   「プラグインを追加できるか？」「マニフェストを受け取れるか？」「集計が正しく動くか？」といった **Core側の連携ロジック** をテストするため。

### B. Plugin Team Testing (Core Simulator / SDK)
Pluginチームは、JBWOSの本体がなくてもプラグイン単体で動作確認できるよう、**「Plugin SDK / Harness」** を使用します。

*   **Core Simulator (Harness)**:
    *   JBWOSの全機能を含まない、軽量なホスト環境。
    *   単なる `<div>` コンテナとしてプラグインのUIを表示する。
    *   プラグインが吐き出したデータを `console.log` に出して、正しいフォーマットか検証する機能を持つ。
*   **Purpose**:
    *   「建具エディタのUIは使いやすいか？」「原価計算は合っているか？」といった **Plugin側のドメインロジック** を高速に開発するため。

## 3. Communication Contract (契約)

開発チームが分かれるため、`docs/Manufacturing_Layer_Schema.md` などの **インターフェース定義書（契約書）** が最重要になります。
変更がある場合は、コードを書く前にまずドキュメントを更新し、相手チームと合意形成（PRレビュー）を行うフローを徹底します。

```mermaid
graph TD
    Contract[Interface Definition<br>(Schema.md)]
    
    subgraph Core Team
        MockPlugin[Mock Plugin]
        JBWOS[JBWOS Core]
        JBWOS --> MockPlugin
    end
    
    subgraph Plugin Team
        Simulator[Core Simulator<br>(SDK)]
        Tategu[Tategu Plugin]
        Simulator --> Tategu
    end
    
    Core Team -.->|Agrees| Contract
    Plugin Team -.->|Agrees| Contract
```
