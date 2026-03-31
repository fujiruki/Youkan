# UI改善および機能拡張計画

## User Review Required

> [!NOTE]
> 以下の3点を実施します。
> 1.  汎用ドロップダウン `YoukanDropdown` の作成と適用（詳細画面ヘッダー、プロジェクト作成モーダル）。
> 2.  プロジェクト作成モーダルの会社選択UIの改善（ボタン/ドロップダウンの自動切り替え）。
> 3.  「WordPressのような」プラグイン拡張フックの導入。

## Proposed Changes

### 1. UI Components (Common)

#### [NEW] `src/features/core/ui/YoukanDropdown.tsx`
汎用的なドロップダウンメニューコンポーネント。
- **Trigger**: 任意の要素（ボタン等）をトリガーにできる。
- **Overlay**: `z-[100]` で最前面に表示。
- **Content**: 任意のリストアイテムを表示可能。スクロール対応。

#### [NEW] `src/features/core/plugin-system/ExtensionSlot.tsx`
指定された「拡張ポイント名」に基づいて、登録されたプラグインコンポーネントを描画するスロット。

### 2. Project Creation Modal

#### [MODIFY] `src/features/core/jbwos/components/Modal/TenantSelector.tsx`
- 既存の「4つ以下ならボタン」ロジックは維持。
- ドロップダウンモード時、標準の `<select>` ではなく `YoukanDropdown` を使用してリッチなUIにする。

#### [MODIFY] `src/features/core/jbwos/components/Modal/ProjectCreationDialog.tsx`
- **Plugin Hook**: `isManufacturing` フラグによるハードコードを削除し、`<ExtensionSlot point="project-creation-fields" />` に置き換える。
- **Tenant Selector**: 親プロジェクトがない場合（Rootモード）かつ個人アカウント（または代表者）の場合に表示。

### 3. Decision Detail Modal

#### [MODIFY] `src/features/core/jbwos/components/Modal/DecisionDetailModal.tsx`
- ヘッダーの会社・プロジェクト選択を `YoukanDropdown` に置き換える。

## Detailed Design

### Plugin Registry (Simple Implementation)
`src/features/plugins/registry.tsx` (仮)
```typescript
import { ManufacturingProjectFields } from '../plugins/manufacturing/components/ManufacturingProjectFields';

// 拡張ポイントの定義
export const PluginRegistry = {
    'project-creation-fields': [
        {
            id: 'manufacturing-fields',
            component: ManufacturingProjectFields,
            condition: (context: any) => context.activeScope === 'company' && context.tenant?.config?.plugins?.manufacturing
        }
    ]
};
```

### ExtensionSlot Usage
```typescript
<ExtensionSlot 
    point="project-creation-fields" 
    context={{ activeScope, tenant, clientName, setClientName, ... }} 
/>
```

## Verification Plan

### Automated Verification
1.  **Project Creation Modal**:
    - 「新規プロジェクト作成」ボタンを押下。
    - 個人モード/会社モードを切り替え、会社選択UI（ボタン or ドロップダウン）の表示を確認。
    - テスト用プラグイン設定（モック等）を行い、拡張フィールドが表示されるか確認。
2.  **Dropdown**:
    - 詳細画面ヘッダーおよびプロジェクト作成画面のドロップダウンを展開し、レイアウト崩れがないか確認。

### Manual Verification
- 実際の操作感（クリック、選択、閉じる挙動）を確認。
