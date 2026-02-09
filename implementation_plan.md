# JBWOS UI 刷新詳細設計 (全体一覧2 & 量感カレンダー)

## 1. 目的
JBWOS のコア体験である「全体一覧２」と「量感カレンダー」を、ユーザーの視認性と操作性を最大化するように刷新する。特に、納期（Due）とマイ期日（Prep）の管理を視覚的に統合し、「今何をすべきか」を直感的に判断可能にする。

## 2. システム設計 (MVVM / Logic)

### 2.1 状態管理とドメインロジック (ViewMode / ViewModel)
- **[Domain] 近似期日判定ロジック**:
    - `due_date` (YYYY-MM-DD) と `prep_date` (Unix Timestamp) を比較。
    - いずれか近い方、または両方存在する場合は「制約が厳しい方」を優先表示。
    - フロントエンドの `useNewspaperItems` フックでこの算出を行い、Componentには `displayDate` と `displayDateType` を渡す。
- **[ViewModel] プライバシー判定の透明化**:
    - `items` 取得時に `assignedTo` (camelCase) を確実に保持。
    - `currentUserId` との照合精度を上げ、「自分に関係があるタスク」がマスクされないようにする。

### 2.2 UI/UX 仕様 (View)

#### 全体一覧２ (`NewspaperItem.tsx`)
| 構成要素 | 表示仕様 |
| :--- | :--- |
| **全体構造** | `flex items-center justify-between` による左右分割。 |
| **左側 (Title)** | フォルダアイコン(Project) or 空白 + タイトル。タイトルは `truncate`。 |
| **右側 (Metadata)** | [StatusDot] [DisplayDate] を右寄せで配置。 |
| **StatusDot** | FOCUS状態: 青い●、それ以外(Done除く): 薄いグレーの●、実行中: 点滅。 |
| **DisplayDate** | 納期: 濃い色、マイ期日: 薄い色。形式は `M/d`。 |
| **インデント** | 親プロジェクトに属する場合、左に縦線を表示し、1.5rem ずつインデント。 |

#### 量感カレンダー (`RyokanCalendar.tsx`)
- **カード表記**: `item.title` + `[item.projectTitle.substring(0,4)]`
- **指示線**:
    - アニメーション: `framer-motion` の `duration: 0.5`。
    - リセット: カレンダーの背景クリックで、全てのセル発光（HighLight）を解除。

## 3. テスト計画 (TDD)

### 3.1 単体テスト (`useNewspaperItems.test.ts`)
- [ ] 納期とマイ期日が混在する場合、近い方が `displayDate` に選ばれること。
- [ ] プロジェクト直下のアイテムが正しい `depth` (インデント) で計算されること。
- [ ] `isMasked` が `assignedTo === currentUserId` の場合に `false` になること。

### 3.2 UIテスト
- [ ] 列幅が 25ch を下回る場合に横スクロールが発生すること。
- [ ] 長いタイトルが省略されても、右側の●と日付が重複せず表示されること。

---

## 4. 修正対象ファイル

### Backend
- #### [MODIFY] [CalendarController.php](file:///c:/Users/doorf/OneDrive/ドキュメント/プロジェクト/TateguDesignStudio/backend/CalendarController.php)
    - `assigned_to` の SELECT 追加。`mapItemRow` の適用。

### Frontend
- #### [MODIFY] [NewspaperItem.tsx](file:///c:/Users/doorf/OneDrive/ドキュメント/プロジェクト/TateguDesignStudio/JWCADTategu.Web/src/features/core/jbwos/components/NewspaperBoard/NewspaperItem.tsx)
    - レイアウト刷新（左右分割）、StatusDotの多色化、日付の色分け。
- #### [MODIFY] [useNewspaperItems.ts](file:///c:/Users/doorf/OneDrive/ドキュメント/プロジェクト/TateguDesignStudio/JWCADTategu.Web/src/features/core/jbwos/components/NewspaperBoard/useNewspaperItems.ts)
    - 優先度日付算出ロジックの追加。
- #### [MODIFY] [RyokanCalendar.tsx](file:///c:/Users/doorf/OneDrive/ドキュメント/プロジェクト/TateguDesignStudio/JWCADTategu.Web/src/features/core/jbwos/components/Calendar/RyokanCalendar.tsx)
    - カード文字列結合、アニメーション時間変更、リセットハンドラ追加。
