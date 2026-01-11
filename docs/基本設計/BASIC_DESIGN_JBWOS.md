# JBWOS 基本設計書 (Basic Design Specification)

**Version**: 2.0 (Integrated)
**Based on**: Constitution v2 & Basic Design Strategy Complete
**Target**: All Developers & AI Agents

---

## 0. 位置づけ
本設計書は、**「判断を終わらせるOS (JBWOS)」** と **「建具設計エディタ (Editor)」** を統合した、システムの全体像を定義する。
`docs/企画書/JBWOS_基本設計書_完全版.md` および `CONSTITUTION_UI_SPEC.md` を正とする。

---

## 1. システム全体構成 (System Architecture)

### 1.1 レイヤー構造 (Layered Architecture)
システムは明確に役割の異なる2つの「世界（View）」で構成される。

| Layer | View Name | Role | Characteristics |
|---|---|---|---|
| **Layer 1** | **Internal View** (JBWOS) | **判断 (Judgment)** | ユーザーの内面。主観的。期限は「フック」。他者に見せない。 |
| **Layer 2** | **External View** (Editor) | **説明 (Explanation)** | 他者への説明資料。客観的。期限は「締切」。正確性重視。 |

### 1.2 画面構成 (Screen Structure)

1.  **Global Decision Board (HOME)**
    *   アプリの絶対的なエントリーポイント。
    *   Inbox / Waiting / Ready / Pending の4バケツのみ存在。
    *   すべてのプロジェクトのタスクがここに集約される。

2.  **Project List / Detail (External)**
    *   プロジェクト（案件）の管理画面。
    *   従来の「建具表」「ガントチャート」はここに属する。

3.  **Door Editor (External)**
    *   建具の詳細設計・作図を行うプロフェッショナルツール。

---

## 2. Global Decision Board 基本設計 (Layer 1)

### 2.1 カラム構成と役割
詳細は `CONSTITUTION_UI_SPEC.md` 参照。

- **Inbox（未判断）**:
    - **耐久設計 (Durability)**: 7件まで表示、以降は折りたたみ。「見えなくする」ことで圧力を下げる。
    - **割り込み (Interrupt)**: 「今」発生したタスクは最上位に浮上。
    - **期限フック**: 作業日ではなく「判断再開日」として機能。

- **Waiting（外部待ち）**:
    - 理由（誰待ち・何待ち）が必須。

- **Ready（今日向き合う）**:
    - **絶対制限**: 最大2件。
    - **完了体験**: 空になったら「今日はもう十分」と表示。

- **Pending（意図的保留）**:
    - デフォルトで閉じられている。

### 2.2 データモデル (Data Model)

`JudgableItem` (JBWOS) と `Door` (Editor) は概念的に分離されるが、実装上は `Door` エンティティにJBWOS用のプロパティを拡張する形で保持する（または1対1のリレーションを持つ）。

```typescript
type JudgmentStatus = 'inbox' | 'waiting' | 'ready' | 'pending' | 'done';
type DeadlineHook = 'today' | 'tomorrow' | 'this_week' | 'next_week' | 'someday';

interface JBWOSMetadata {
  status: JudgmentStatus;
  dueHook: DeadlineHook;   // 判断再開フック（≠ 納期）
  weight: 1 | 2 | 3;       // 心理的重み（並び順には影響しない）
  interrupt: boolean;      // 割り込みフラグ
  memo: string;            // 横メモ（判断ログ）
  waitingReason?: string;  // Waiting理由
}

// 既存のDoor/Projectエンティティにこれをmix-in、または紐付ける
```

---

## 3. External View エディタ機能 (Layer 2)

詳細は `docs/基本設計/EDITOR_SPEC.md` (旧 SYSTEM_DESIGN_SPECIFICATION) を参照。

- **役割**: 成果物（図面・見積書・建具表）を作成するための機能群。
- **UIガイドライン**: `docs/基本設計/UI_DESIGN_GUIDELINE.md` に従う（高密度・プロ向けUI）。
- **JBWOSとの接続**:
    - エディタで作成したデータは、"Item" として Inbox に投入される。
    - エディタ側での操作（保存など）は、Internal View の状態（Inbox等）には即座には影響しないが、ユーザーが「判断」を行うための材料となる。

---

## 4. Googleカレンダー連携 (Bridge)

- **方向**: JBWOS -> Google Calendar (One-way)
- **トリガー**: 「Readyに入れた時」または「Waitingの期限設定時」
- **内容**: 作業そのものではなく、「判断結果」または「判断予約」を書き込む。
- **絶対ルール**: カレンダー側からJBWOSの状態を変更してはならない。

---

## 5. 運用フロー (Workflow)

1.  **起動**: Global Decision Board (Internal) が開く。
2.  **判断**: Inbox のアイテムを Ready / Waiting / Pending に振り分ける（または今日はやらない）。
3.  **作業**: Ready にあるアイテム（例: 「A邸建具設計」）を開くと、External View (Editor/Project) に遷移する。
4.  **完了**: 作業を終えて Home に戻る。Ready アイテムを Done にする。
5.  **終了**: Ready が空になったら、アプリを閉じる。

---

以上
