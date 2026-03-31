# データ連携とテスト戦略 (Data Linking & Test Strategy)

## 目的
プラグインが **Manufacturing Layer** とシームレスにデータをやり取りできるようにし、かつ各層のテストが独立して実施できることを保証します。

## データ連携フロー
1. **プラグイン側** は `ManufacturingPlugin` インターフェースを実装し、`provideDeliverables(): Deliverable[]` を通じて **Manifest** にデータを提供。
2. **Core** は `ManufacturingBus` を介して全プラグインからの `Deliverable` を集約し、`ManufacturingManifest` に格納。
3. **UI** は `useManifest()` フックで `ManufacturingManifest` を取得し、一覧表示・編集を行う。
4. **永続化** は `backend` の API (`POST /api/manufacturing/manifest`) が受け取り、SQLite に保存。

### 主要インターフェース（`docs/Manufacturing_Layer_Schema.md` 参照）
- `interface Deliverable { id: string; name: string; cost: number; time: number; pluginData: any; }`
- `interface ManufacturingPlugin { provideDeliverables(): Deliverable[]; }`
- `class ManufacturingBus { register(plugin: ManufacturingPlugin): void; getManifest(): ManufacturingManifest; }`

## テスト戦略
### 1. ユニットテスト
- **プラグイン側**: `provideDeliverables` が正しいスキーマの `Deliverable` 配列を返すかを検証。
- **Core 側**: `ManufacturingBus.register` がプラグインを正しく登録し、`getManifest` が期待通りに集約できるかをテスト。
- 使用フレームワーク: `vitest`（フロント）・`phpunit`（バックエンド）。

### 2. 統合テスト
- **API エンドポイント** `/api/manufacturing/manifest` に対し、プラグインが生成した `Deliverable` を POST し、DB に正しく保存されるかを検証。
- **Mock Plugin** を利用し、Core が実際のプラグインなしでも動作することを確認。

### 3. E2E テスト（Playwright）
- **シナリオ**: プラグインの UI で新規 Deliverable を作成 → Manifest 一覧に反映 → データベースに永続化 → 再読み込みで正しく表示されるか。
- **チェックポイント**: アイコン、コスト、時間が期待通りに表示され、合計金額・総工数が正しく計算される。

## テスト実装例（フロント）
```tsx
import { renderHook, act } from '@testing-library/react-hooks';
import { useManufacturingBus } from '../hooks/useManufacturingBus';

test('register mock plugin and get manifest', () => {
  const { result } = renderHook(() => useManufacturingBus());
  const mockPlugin = {
    provideDeliverables: () => [{ id: 'd1', name: 'Door', cost: 1200, time: 3, pluginData: {} }]
  };
  act(() => {
    result.current.register(mockPlugin);
  });
  expect(result.current.getManifest().deliverables).toHaveLength(1);
});
```

## CI/CD への組み込み
- **GitHub Actions**: `npm run test:unit`、`npm run test:integration`、`npm run test:e2e` をプルリクエスト時に自動実行。
- **カバレッジ**: `vitest --coverage` で 80% 以上を目標に設定。

> [!NOTE]
> データ連携は **インターフェース契約** が最重要です。実装前に `Manufacturing_Layer_Schema.md` を更新し、相互レビューを必ず行ってください。
