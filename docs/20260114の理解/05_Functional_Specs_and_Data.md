# 05. 機能仕様とデータモデル (Functional Specs & Data)

## 1. 4つのバケツ (The 4 Buckets)
JBWOSのデータ状態は、以下の4つ（＋Done）のいずれかに必ず属する。独自ステータスは認めない。

### ① Inbox (未判断)
- **定義**: まだ「やる」とも「やらない」とも決めていないもの。
- **UI**: 縦リスト。上から直近7件のみ表示（Durability設計）。
- **メッセージ**: 「今は考えなくていい」。
- **自動化**: 期限フック（Due Hook）により、未来のアイテムが自動的にここに浮上する。

### ② Waiting (他者待ち)
- **定義**: 自分ではどうにもならないもの。
- **必須項目**: `waitingReason` (理由)。「材料待ち」「承認待ち」など。
- **UI**: 薄く表示。
- **扱い**: 自分のタスク量（Ready上限）にはカウントしない。

### ③ Ready (今日やる)
- **定義**: 今日、自分が向き合うと決めたもの。
- **絶対制約**: **最大 2件**。
    - 3件目を入れようとするとシステムがブロックする。
    - 設定での上限変更不可。
- **トリガー**: ここに入れた瞬間、Googleカレンダー（External）に「作業ブロック」が出現する。

### ④ Pending (保留)
- **定義**: 将来やりたいが、今は視界に入れたくないもの。
- **UI**: デフォルト折りたたみ。
- **扱い**: 検索しない限り出てこない。

---

## 2. データモデル (Data Model)

### Items Table (Schema)
すべての判断対象（建具、タスク、メモ）は `items` として一元管理される。

```typescript
interface Item {
  id: string;               // UUID
  title: string;            // 件名
  
  // --- Core State ---
  status: 'inbox' | 'waiting' | 'ready' | 'pending' | 'done';
  statusUpdatedAt: number;  // 最終ステータス変更日時
  
  // --- JBWOS Props ---
  interrupt: boolean;       // 割り込みフラグ（Inbox最上位固定）
  waitingReason?: string;   // Waiting理由
  
  // --- Calendar Props (Optimistic) ---
  dueDate?: string;         // YYYY-MM-DD (納期・確定)
  prepDate?: string;        // YYYY-MM-DD (備え目安・ぼやけ)
  
  // --- Context ---
  projectId?: string;       // 案件ID (Optional)
  doorId?: string;          // 建具ID (Optional)
  
  // --- Logs ---
  history: HistoryLog[];    // 判断履歴
}
```

---

## 3. UIコンポーネント仕様

### ItemCard
- **デザイン**: 統一デザイン。Project名やDoor情報は「タグ」として小さく表示。
- **操作**:
    - **Single Click**: 判断モーダルOPEN。
    - **Drag**: バケツ間の移動。

### QuantityCalendar
- **表示**: アイテムごとの帯（Bar）は表示しない。
- **セル描画**:
    - **確定（Deadline）**: 四角いアイコン。
    - **備え（Prep）**: ぼやけた円。
    - **量感（Volume）**: セルの背景色の濃淡（Heatmap）。
- **インタラクション**:
    - **Click**: 「圧力ライン」の描画。詳細モーダルは出さない（ダブルクリック時は出す）。

---

## 4. 自動化ルールと禁止事項

### ✅ 許可される自動化
- **Due Hook**: 期限が近づいたら、PendingからInboxへ移動させる。
- **Cleanup**: 完了して30日経過したDoneアイテムをアーカイブする。

### ❌ 禁止される自動化 (Auto-Judgment Ban)
- **Auto-Ready**: 期限が今日だからといって、Inboxから勝手にReadyに移動させること。
    - 理由：今日のキャパシティは人間が決めるべきだから。
- **Auto-Failure**: 日付を過ぎたものを「未達成」マークすること。
- **Re-prioritize**: Inboxの中身を勝手に並び替えること。
