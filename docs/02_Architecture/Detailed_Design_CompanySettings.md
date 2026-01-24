# 詳細設計書: 会社設定とプラグイン管理 (Company Settings & Plugin Architecture)

## 0. 概要 (Overview)
「会社 (Tenant)」が「機能 (Plugin)」の利用権限を管理し、「ユーザー (User)」はその権限下で業務を行うための詳細設計。
個人的なカスタマイズ機能（Personal Plugins）は今回はスコープ外とし、**「会社による業務機能のON/OFF」** に集中する（Plan C）。

## 1. データモデル (Data Model)

### 1.1 Tenants Table Schema
`tenants` テーブルに `config` カラム (JSON) を追加し、フラグ管理を行う。

```sql
ALTER TABLE tenants ADD COLUMN config TEXT; -- JSON
```

### 1.2 Config JSON Structure
```json
{
  "plugins": {
    "manufacturing": boolean,  // 製造業プラグイン (Factory, Process)
    "tategu": boolean          // 建具表プラグイン (Joinery Editor)
  },
  "settings": {
    // 将来用: 端数処理設定など
  }
}
```

### 1.3 依存関係 (Dependencies)
| Plugin | 親Plugin | 条件 |
| :--- | :--- | :--- |
| **Manufacturing** | なし | 独立してON/OFF可能 |
| **Tategu** | **Manufacturing** | ManufacturingがONの場合のみONにできる |

> [!NOTE]
> 建具を作るには「製造工程」や「材料」の概念が必要なため、この依存関係は強制的とする。

## 2. 振る舞い仕様 (Behavior Specifications)

### 2.1 機能ON時の挙動
*   **Manufacturing ON**:
    *   サイドバーに「工場設定 (Factory)」が出現。
    *   プロジェクト作成時に「製造業プロジェクト」が選択可能になる。
    *   プロジェクト詳細に「成果物 (Deliverables)」「工程 (Process)」タブが出現。

*   **Tategu ON**:
    *   プロジェクト内で「建具表」の作成が可能になる。
    *   建具エディタへのアクセスが可能になる。

### 2.2 機能OFF時の挙動 (Graceful Degradation)
会社がプラグインをOFFにした場合、データは削除しないがアクセスを遮断する。

*   **UI非表示**: サイドバーやタブから該当メニューが消える。
*   **アクセス制御**: 直接URL（例: `/editor/...`）を叩いても、`403 Forbidden` または「この機能は会社設定により無効化されています」画面を表示する。
*   **データ保護**: 作成済みの建具表データなどはDBに残る（誤操作対策）。再度ONにすれば復活する。

## 3. 画面設計 (UI Design)

### 3.1 設定画面 (/settings)
タブ構成:
1.  **会社情報 (Company Profile)**
    *   会社名、住所、電話番号、インボイス番号、銀行口座情報
    *   保存ボタン（即時反映）
2.  **機能管理 (Plugins/Features)**
    *   プラグイン一覧リスト
    *   トグルスイッチ (ON/OFF)
    *   **依存制御**: ManufacturingをOFFにすると、自動的にTateguもOFFになる。ManufacturingがOFFの間、Tateguは操作不能（Disabled）。
3.  **メンバー (Members)**
    *   社員一覧表示（今回は参照のみ、将来招待機能）
4.  **システム (System)**
    *   従来の設定項目（検証用など）

### 3.2 状態管理 (Frontend Implementation)
`AuthProvider` または `TenantProvider` にて `currentTenant.config` を監視。

```typescript
// usePlugin("tategu") hook
export const usePlugin = (pluginName: keyof PluginConfig) => {
  const { tenant } = useAuth();
  return tenant?.config?.plugins?.[pluginName] ?? false;
};
```

各コンポーネント（SidebarItemなど）は `usePlugin` を見て表示/非表示を決定する。

## 4. エッジケース対応 (Edge Cases)

*   **Case 1: 編集中にOFFにされた**
    *   リアルタイム検知は今回はしない（Socket通信などはないため）。
    *   次回画面遷移時やAPIコール時にエラーまたは非表示となる。
*   **Case 2: 依存元の強制OFF**
    *   UI上では連動してOFFにするアラートを出す。「製造業プラグインをOFFにすると、建具機能も使えなくなりますがよろしいですか？」

## 5. 実装フェーズ (Implementation Steps)

1.  **Backend**: `migrate_v12` 実行。`TenantController` の update メソッド実装。
2.  **Frontend Logic**: `usePlugin` フックの実装。`JbwosTenant` 型定義の確定。
3.  **Frontend UI**: `SettingsScreen` のタブ化と `PluginManagement` コンポーネントの完成。
4.  **Integration**: 各画面（Sidebar等）への `usePlugin` ガードの適用。
