# 詳細画面ドロップダウンのUI改善計画

詳細画面（DecisionDetailModal）のヘッダーにある「所属会社」および「所属プロジェクト」選択ドロップダウンの操作性と視認性を向上させます。

## User Review Required

> [!NOTE]
> 既存のインライン実装を、再利用可能な**共通コンポーネント (`HeaderDropdown`)** として切り出します。
> これにより、会社選択・プロジェクト選択の両方に一貫したデザインと挙動（修正）が適用されます。

## Proposed Changes

### UI Components

#### [NEW] `src/features/core/jbwos/components/Modal/HeaderDropdown.tsx`
会社選択・プロジェクト選択で共通して使用できるドロップダウンコンポーネントを新規作成します。

**主な機能と改善点:**
- **Compact List Items**: アイテムのパディングを `py-2` から `py-1` に縮小し、`gap` を `1px` (または `0px`) に設定して一覧性を高めます。
- **Higher Z-Index & Overlay**: ドロップダウンのコンテナに `z-[100]` を適用し、カレンダー等の他要素より確実に手前に表示します。
- **Smart Scrolling**: `max-h-[300px]` (または画面高に応じた値) を設定し、アイテム数が多い場合は自動的にスクロールバーを表示します。
- **Flexible Content**: 会社（Tenant）とプロジェクト（Project）の異なるデータ構造に対応できるよう、レンダリングロジックをプロパティ（`renderItem`）またはジェネリック型で柔軟にします。

#### [MODIFY] `src/features/core/jbwos/components/Modal/DecisionDetailModal.tsx`
- 既存のインライン記述（会社選択・プロジェクト選択）を削除し、新しい `HeaderDropdown` コンポーネントに置き換えます。
- 状態管理（`activeMenu`）はそのまま利用し、開閉制御を行います。

## Detailed Design

### HeaderDropdown Props Interface (Draft)
```typescript
interface HeaderDropdownProps<T> {
    isOpen: boolean;
    onClose: () => void;
    items: T[];
    selectedId: string | null;
    onSelect: (item: T | null) => void;
    
    // UI Labels
    headerLabel: string; // "アカウント (Tenant)" etc.
    emptyLabel?: string;
    
    // Render Props
    renderItem: (item: T, isSelected: boolean) => React.ReactNode;
    renderDefaultOption?: (isSelected: boolean) => React.ReactNode; // "Private" or "Inbox"
    
    // Position Ref (Optional)
    anchorRef?: React.RefObject<HTMLElement>;
}
```

### Style Adjustments
- **Item Padding**: `py-1` (4px)
- **Item Margin**: `mb-0.5` -> `mb-0` (隣接兄弟セレクタ等でボーダー制御も検討)
- **Dropdown Container**:
    - `absolute top-full left-0 mt-1`
    - `z-[999]` (カレンダーが z-10 程度なら十分だが、念のため高めに設定)
    - `max-h-[300px] overflow-y-auto`
    - `shadow-xl border border-slate-200`

## Verification Plan

### Automated Verification (Browser Subagent)
1. **Dropdown Layout**:
   - 詳細画面を開き、会社選択ドロップダウンを展開する。
   - スクリーンショットを撮影し、アイテム間の余白が狭まっていることを確認する。
   - カレンダーの上に重なって表示されていることを確認する。
2. **Scrolling**:
   - プロジェクト選択ドロップダウン（アイテム数が多い場合）を展開する。
   - スクロールバーが表示されているか確認する（アイテム数次第）。

### Manual Verification
- 実際にクリックして、ドロップダウンがスムーズに開閉するか。
- アイテムを選択して、正しくデータが更新されるか。
- 会社とプロジェクトの両方で同じ挙動になっているか。
