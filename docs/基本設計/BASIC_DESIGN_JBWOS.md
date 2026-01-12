# 基本設計書 (JBWOS: Judgment Based Work Operating System) v2.0
最終更新: 2026-01-12 (JST)

本ドキュメントは、建具設計業務向けOS「JBWOS」の基本設計を定義する。
**2026-01-12の再定義**に基づき、システムの中核思想と構造を刷新した。

---

## 0. システム定義（Constitution）

本システムは **「やること（TODO）」を管理しない**。
**「決めるべき瞬間（判断対象）」だけを浮かび上がらせ、決めたら迷わせずに実行へ流す。**
実行できなかった事実は残すが、失敗には変換しない。

---

## 1. システム構造（Layer Architecture）

システムは以下の3層で構成される。各層は責務が明確に分離されており、混ざり合うことはない。

### 1-1. Decision Layer（判断層）
*   **責務**: 「今、Yes/No/いつ/どれ を決めないと前に進まない問い」を管理する。
*   **構成要素**:
    *   **Inbox**: 未分別の判断対象を放り込む場所。
    *   **GDB (Global Decision Board)**: RDD（判断期限）に到達した「判断すべきもの」だけが表示される場所。
    *   **Today**: 今日の判断（Commit）を行う場所。

### 1-2. Execution Layer（実行層）
*   **責務**: 判断の結果として決まった「制作・作業」を実行する。
*   **構成要素**:
    *   **ExecutionContext**: 「この制作を進める」という実行コンテキスト。
    *   **ExecutionBlock**: 1日単位の消化ブロック。自動生成される。
*   **ルール**: ExecutionBlockは「判断対象」ではないため、GDBには絶対に表示されない。

### 1-3. Life Layer（生活層）
*   **責務**: ユーザーの生活維持（掃除、休息など）を管理する。
*   **ルール**: 判断対象外。実行（Execution）の前提条件となるが、未完了でも「失敗」とは扱わない。

---

## 2. Decision Layer 詳細設計

### 2.1 GDB (Global Decision Board)
**「判断対象のみ」** が存在できる聖域。作業タスクや進捗報告はここには入らない。

*   **出現ロジック**: `Today >= RDD_x` かつ `Unresolved`
*   **RDD (Recommended Decision Date)**: 
    *   建具におけるRDD算出: `InstallDate` (取付日) から逆算。
    *   `RDD_start = InstallDate - E_mfg` (制作日数)

### 2.2 Inbox
*   **UX**: ユーザーは何も考えずに放り込むだけ。
*   **自動分類**: システムが内容を解析し、8割を自動分類する（タグ付け、プロジェクト紐付け）。

### 2.3 Today (Commit)
*   **Commit枠**: 最大2件（厳守）。
    *   これは「最低限これだけは決める/着手する」ライン。
*   **Progress枠**: 進めたいもの（上限なし、デフォルト折りたたみ）。
*   **操作制限**: 朝の操作は「承認」または「1件差し替え」のみ。迷わせない。

---

## 3. Execution Layer 詳細設計

### 3.1 ExecutionBlock
*   制作開始（Decision確定）トリガで、必要な日数分のBlockが自動生成される。
*   **UI表示**: Today画面には直接並ばない。「現在のActive Context」として、次に消化すべき1ブロックのみが提示される。

### 3.2 完了条件
*   全Blockが `Done` になると、プロジェクト（または制作単位）が完了となる。

---

## 4. Life × Execution 衝突ルール
*   **物理的制約**: Life（生活）が終わっていない場合、Execution（仕事）は開始できない（自動保留）。
*   **非懲罰**: Executionが進まなかった場合、その事実は記録されるが、「遅延」「サボり」といったネガティブなフィードバックは行わない。

---

## 5. データモデル (Schema Overview)

### テーブル構成
1.  **tbl_Project**: 案件基本情報
2.  **tbl_Decision**: 判断オブジェクト（Type: start, material, order, estimate, exception）
3.  **tbl_ExecutionBlock**: 実行ブロック
4.  **tbl_Production**: 制作管理（RDD算出の基点）

### イベント駆動
*   **DecisionResolved**: 判断確定時に発火。
    *   副作用: ExecutionBlock生成、ステータス更新など。

---

## 6. UI/UX 指針

*   **Inboxファースト**: 入力はInboxのみ。
*   **自動化**: 日付計算、分類、ブロック生成は全てシステムが行う。
*   **GDBの純度維持**: 「作業」をGDBに表示しないテストを通過すること。

---

## 7. 用語集
*   **RDD**: Recommended Decision Date（推奨判断日）
*   **GDB**: Global Decision Board
*   **Commit**: 今日必ずやると決めた最大2件の判断/着手
*   **Context**: 実行中の制作案件
