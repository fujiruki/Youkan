# JBWOS Enterprise Architecture: The "Company Brain"
Version: 0.2 (Concept Draft with Calendar)
Date: 2026-01-18

## 1. 核心思想: "Private Core, Public Volume"
組織導入における最大の課題は、「個人のプライバシー（マイクロマネジメントへの恐怖）」と「組織の透明性（経営判断の必要性）」の対立である。
JBWOS Enterpriseは、この対立を**「データの抽象化」**によって解決する。

*   **Private Core**: 「誰が、いつ、何をやるか」の詳細（Task）は、個人のJBWOS内に秘匿される。
*   **Public Volume**: 「誰が、いつ、**どのくらい忙しいか**」の量感（Volume）だけが、組織全体に公開される。

---

## 2. システム構成レイヤー

### Layer 1: Distributed Individual OS (端末ごとの脳)
各社員が持つ独立したJBWOSインスタンス。
*   **権限**: 本人のみアクセス可能（社長でも覗けない）。
*   **データ**: ローカル（または暗号化された個人クラウド領域）。
*   **出力**: 1日ごとの「予測消費Weight（量感）」をサーバーへ送信。
    *   例: 2026-02-01: 8.5h / 2026-02-02: 4.0h

### Layer 2: The "Stock" Pool (Shop Floor / 共有の倉庫)
まだ誰のInboxにも入っていない、宙に浮いた案件の保管場所。
*   **Visual**: 個別のタスク詳細ではなく、「Project Package（箱）」として抽象化して表示（圧迫感の軽減）。
*   **Action**:
    1.  **Grab (Pull)**: 社員が自ら「Shop Floor」に行き、「これをやります」と自分のレーンに引き入れる（自律性の尊重）。
    2.  **Dispatch (Push)**: 誰も取らない場合、社長がドラッグ＆ドロップで強制配分する（最終調整）。

### Layer 3: Company Brain (全脳シミュレーター)
Layer 1から集めた「量感」と、Layer 2にある「在庫」を使って、未来を予測するエンジン。

---

## 3. 主要機能仕様

### 3.1 Aggregated Heatmap (組織ヒートマップ)
全社員の「量感」を重ね合わせたカレンダービュー。**「赤（危険）」は使わない。**

*   **Visual**: 社員を行、日付を列とするガントチャート風ヒートマップ。
*   **表現 (Psychological Safety)**:
    *   **Deep Blue (没頭)**: 埋まっている状態。「集中している」とポジティブに解釈する。
    *   **Light Blue (余白)**: 空いている状態。
    *   **Ripple/Overflow (波紋)**: 容量超過時は、色ではなく形状（枠からの滲み出しなど）で表現する。
*   **Action**: 濃紺の日のタスクを、淡い日のセルに移動させる。

### 3.2 Virtual Fluid Simulation (完了予測)
Stockにある未割当案件が、「もし今の空きリソースに最速で詰め込まれたら、いつ終わるか？」を計算する。

*   **Algorithm**:
    1.  `StockQueue` から案件を一つ取り出す。必要なWeight（例: 50h）を取得。
    2.  `ResourceMap`（全社員の空きスロット）を現在日から走査。
    3.  空きスロットにWeightを注ぎ込む（Fluid Fill）。
    4.  Weightがゼロになった時点の日付を `EstimatedCompletionDate` とする。
*   **Output**: 「この案件の納期回答目安: **3月15日**」と即座に表示。

### 3.3 Project Monitor (プロジェクト進捗)
タスク単位ではなく、Deliverable（成果物）やProject単位の達成度を表示。

*   **Source**: 各個人のJBWOSでタスクが完了すると、非同期でサーバー上のProjectステータスが更新される。
*   **Display**: プログレスバーのみ。「詳細」は見えないが「進んでる/止まってる」はわかる。

### 3.4 Calendar Integration (Capacity Tuning) [NEW]
Google Calendarとの連携により、動的なCapacity（稼働可能時間）調整を行う。

*   **Two Calendars Strategy**:
    1.  **Work Calendar (弊社勤務用)**:
        *   JBWOSの割当や、業務上の予定が入る。
    2.  **Private Calendar (弊社以外)**:
        *   プライベートな予定や、他社の仕事が入る。
        *   会社側からは**「内容は不可視（masked）」**だが、**「その時間は稼働不可」**として扱われる。
*   **Dynamic Capacity Calculation**:
    *   `DailyCapacity = StandardWorkHours - PrivateEventHours`
    *   これにより、「今日は午後休む（Private予定あり）」の場合、Capacityが減り、Simulationは自動的にその分を後ろ倒し計算する。

### 3.5 Pre-Sales Simulator (受注前シミュレーション) [NEW]
「この仕事を取っても大丈夫か？ いつ納品できるか？」を、正式受注前に検証するサンドボックス機能。

*   **Trial run**:
    *   Stockを汚さずに、「工数: 150h」のような仮のプロジェクトをシミュレーションエンジンに投入できる。
    *   **Scenario A**: 「最短でいつ終わる？」 -> 現在のStockの最後尾に追加した場合の完了日を算出。
    *   **Scenario B**: 「3月末に納品したいが、可能か？」 -> 逆算して、いつまでに着手が必要か、あるいは今のリソースで間に合うかを判定（赤/青で回答）。
*   **Decision Support**:
    *   経営者はこの結果を見て、「受注する（Stockに入れる）」か「断る/時期をずらす」かを判断できる。

---

## 4. データモデル (Schema Concept)

```typescript
// 個人から吸い上げるデータ (匿名化された量感)
interface UserDailyVolume {
  userId: string;
  date: string; // YYYY-MM-DD
  totalWeight: number; // その日のタスク総量 (hours)
  capacity: number;    // その日の定時稼働可能時間 (hours) - Private予定分
}

// 共有倉庫にあるデータ
interface UnassignedJob {
  id: string;
  projectId: string;
  requiredWeight: number; // 見積もり工数
  dueDate?: string;
  dependencies: string[]; // 前工程など
}
```

## 5. ロードマップ

1.  **Phase 1**: Stock機能の実装（現在進行中の議論）。データの分離。
2.  **Phase 2**: User Capacityの設定と、Volume集計ロジックの実装。
3.  **Phase 3**: 社長用ダッシュボード（Heatmap）の実装。
4.  **Phase 4**: Simulationエンジンの開発。
5.  **Phase 5**: Google Calendar連携によるCapacity自動調整。
