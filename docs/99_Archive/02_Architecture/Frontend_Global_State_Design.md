# フロントエンド グローバルステート管理設計書

> 最終更新: 2026-03-04  
> 対象: `JWCADTategu.Web/src/`

## 概要

本プロジェクトのフロントエンドにおいて、複数画面にまたがるグローバルな状態は **React Context** と **カスタムイベント（CustomEvent）** の2つの仕組みで管理する。

| 仕組み | 用途 | 例 |
|---|---|---|
| **React Context** | 同じ値を複数コンポーネントが参照・更新する「共有ステート」 | フィルタモード、完了表示 |
| **CustomEvent** | コンポーネント間の一方向通知・ワンショットアクション | ビューモード変更、データリフレッシュ |

---

## 1. React Context によるグローバルステート

### 1.1 FilterContext

**ファイル**: `features/core/youkan/contexts/FilterContext.tsx`

フィルタ関連の状態を一元管理する。

```typescript
interface FilterContextType {
  filterMode: FilterMode;       // 'all' | 'personal' | 'company' | テナントID
  setFilterMode: (mode: FilterMode) => void;
  hideCompleted: boolean;       // 完了済みアイテムの表示/非表示
  setHideCompleted: (hide: boolean) => void;
  toggleCompleted: () => void;  // hideCompletedの反転
}
```

**Provider配置**: `App.tsx` → `<FilterProvider>` が `<UndoProvider>` の外側

**利用パターン**:
```typescript
const { filterMode, hideCompleted } = useFilter();
```

**参照コンポーネント**:

| コンポーネント | 利用するプロパティ |
|---|---|
| `YoukanHeader.tsx` | filterMode, setFilterMode, hideCompleted, toggleCompleted |
| `useYoukanViewModel.ts` | filterMode（読み取りのみ） |
| `DashboardScreen.tsx` (youkan) | hideCompleted |
| `ProjectRegistryScreen.tsx` | filterMode → activeScope同期 |
| `VolumeCalendarScreen.tsx` | filterMode |
| `DashboardScreen.tsx` (旧) | filterMode, hideCompleted |
| `ScheduleBoard.tsx` | filterMode, hideCompleted |

**設計原則**:
- filterMode / hideCompleted は **FilterContextのみが管理する**（単一の真実の源泉）
- localStorage永続化は **FilterContext内部のみ** で行う
- 各コンポーネントは `useFilter()` hookで状態を取得する

### 1.2 UndoContext

**ファイル**: `features/core/youkan/contexts/UndoContext.tsx`

直前の操作の取り消し（Ctrl+Z）を管理する。

### 1.3 AuthProvider

**ファイル**: `features/core/auth/providers/AuthProvider.tsx`

認証情報・テナント情報を管理する。

### Provider階層

```
<ToastProvider>
  <AuthProvider>
    <FilterProvider>        ← グローバルフィルタ
      <UndoProvider>        ← 操作取り消し
        <YoukanHeader />
        <各画面コンポーネント />
      </UndoProvider>
    </FilterProvider>
  </AuthProvider>
</ToastProvider>
```

---

## 2. CustomEvent によるコンポーネント間通信

以下のイベントは **カスタムイベントのまま維持する**。

### 2.1 一覧

| イベント名 | 定数 | dispatch元 | listen先 | 用途 |
|---|---|---|---|---|
| `youkan-view-mode-change` | `VIEW_MODE_CHANGE` | YoukanHeader | DashboardScreen | ダッシュボードビューモード切替 |
| `youkan-data-changed` | `DATA_CHANGED` | ViewModel, UndoContext | ViewModel, hooks | データ変更後のグローバルリフレッシュ |
| `youkan-capacity-update` | `CAPACITY_UPDATE` | DashboardScreen | YoukanHeader | キャパシティ表示更新 |
| `youkan-open-project-modal` | `OPEN_PROJECT_MODAL` | YoukanHeader, Registry | App.tsx | プロジェクト作成モーダル表示 |
| `youkan-calendar-view-mode-change` | `CALENDAR_VIEW_MODE_CHANGE` | YoukanHeader | CalendarScreen | カレンダービューモード切替 |
| `youkan-project-view-mode-change` | `PROJECT_VIEW_MODE_CHANGE` | YoukanHeader | ProjectRegistry | プロジェクトビューモード切替 |

### 2.2 Context化しない理由

| イベント | 理由 |
|---|---|
| `VIEW_MODE_CHANGE` 系 | ヘッダー→画面への一方向通信。各画面が独立にlisten。Context化してもprovider内のすべてのコンポーネントが再描画され、パフォーマンス上不利。 |
| `DATA_CHANGED` | 「データが変わった」というシグナルであり、状態値ではない。イベントバス（Pub/Sub）パターンが適切。 |
| `CAPACITY_UPDATE` | 画面→ヘッダーへの逆方向通信。Context化すると表示値の更新で不要な再描画が発生する。 |
| `OPEN_PROJECT_MODAL` | ワンショットのトリガーイベント。保持すべき状態がない。 |

---

## 3. 定数管理

**ファイル**: `features/core/session/youkanKeys.ts`

```typescript
export const YOUKAN_KEYS = { ... };   // localStorageキー名
export const YOUKAN_EVENTS = { ... }; // カスタムイベント名
```

すべてのlocalStorageキーとカスタムイベント名は、このファイルの定数を使用すること。文字列リテラルの直接使用は禁止。

---

## 4. 判断基準: Contextにすべきか、イベントにすべきか

新しいグローバル状態・通信を追加する場合、以下の基準で判断する。

| 条件 | Context | CustomEvent |
|---|---|---|
| 複数コンポーネントが**同じ値を参照する** | ✅ | |
| 状態に持続性がある（永続化が必要） | ✅ | |
| 一方向の通知で十分 | | ✅ |
| ワンショットのアクション | | ✅ |
| シグナル（「何かが起きた」の通知） | | ✅ |
| 画面をまたいで双方向に同期が必要 | ✅ | |
