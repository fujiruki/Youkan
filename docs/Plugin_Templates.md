# Plugin Templates (プラグインテンプレート)

## 目的
プラグイン開発者が共通で利用できる UI/UX テンプレートを提供し、開発速度と一貫性を向上させます。

## テンプレート構成
- **タスクテンプレート**: `TaskTemplate.tsx`
  - タスク名、期限、担当者、見積もり日数の入力フィールドを含む。
  - `useTaskTemplate` フックで状態管理とバリデーションを提供。
- **プロジェクトテンプレート**: `ProjectTemplate.tsx`
  - プロジェクトタイプ選択、マニフェストエディタ、プラグイン固有設定パネルを含む。
  - `useProjectTemplate` フックでプラグイン間の設定共有を実装。
- **設定パネルテンプレート**: `PluginSettingsPanel.tsx`
  - カラーパレット、アイコン選択、プラグイン固有オプションを提供。

## 使用方法
1. `src/plugins/<plugin-name>/templates/` にテンプレートをコピー。
2. 必要に応じて UI コンポーネントをカスタマイズし、`use<TemplateName>` フックをインポート。
3. テンプレートが提供する `onSave` コールバックで `ManufacturingPlugin` インターフェースに沿ったデータを保存。

## カスタマイズ例
```tsx
import { TaskTemplate, useTaskTemplate } from "../templates/TaskTemplate";

const MyTask = () => {
  const { task, setTask } = useTaskTemplate();
  return <TaskTemplate task={task} onChange={setTask} />;
};
```

> [!NOTE]
> テンプレートはプラグイン間で共有できるように `src/plugins/common` に配置し、`package.json` の `exports` で公開します。
