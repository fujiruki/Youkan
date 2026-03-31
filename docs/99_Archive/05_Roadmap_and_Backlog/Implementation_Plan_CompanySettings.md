# 会社設定機能 (Company Settings) 実装計画

AI専門家会議の結論に基づき、SaaSの標準機能としての「会社設定」を実装します。

## 実装ゴール
1. **会社設定画面の実装**: `SettingsScreen` を拡張し、会社情報の閲覧・編集を可能にする。
2. **データモデル拡張**: `Tenant` 型に必要なプロパティを追加し、バックエンド連携を整備する。
3. **メンバー管理**: 社員一覧の表示と権限管理のUIを追加する。

## User Review Required
> [!IMPORTANT]
> **DBスキーマ変更**: `tenants` テーブルへのカラム追加が必要です（住所、インボイス番号など）。
> 今回はMVPとして、フロントエンドの型定義拡張と設定画面のUI実装を行い、バックエンド連携はモックまたは部分的な実装にとどめるか、既存のAPIを拡張します。

## Proposed Changes

### 1. データモデル定義 (Frontend)
`src/features/core/auth/types.ts`
- `Tenant` インターフェースを拡張
- `JbwosTenant` として詳細型を定義

```typescript
export interface JbwosTenant extends Tenant {
    // Basic Info
    address?: string;
    phone?: string;
    invoiceNumber?: string; // T+13桁
    
    // Commerce
    bankInfo?: {
        bankName: string;
        accountType: string;
        accountNumber: string;
    };
    
    // Settings
    closingDate?: number; // 締め日
}
```

### 2. コンポーネント実装
`src/pages/SettingsScreen.tsx` (または `src/features/core/settings/...`)
- タブ構成の導入
    - `[基本設定]`: 社名、住所、インボイス
    - `[アカウント]`: パスワード変更
    - `[メンバー]`: ユーザー一覧、招待
    - `[製造設定]`: (将来用プレースホルダ)

`src/features/core/settings/components/`
- `CompanyProfileForm.tsx`: 会社情報編集フォーム
- `MemberManagement.tsx`: メンバー一覧・招待UI
- `SecuritySettings.tsx`: パスワード変更フォーム

### 3. API/ViewModel
- `useTenantSettings`: テナント情報の取得・更新ロック
- `useMemberManagement`: メンバーの操作

## Verification Plan

### Automated Verification
- なし（UI実装主体のマニュアル検証）

### Manual Verification
1. `admin` ユーザーでログインし、設定画面 (`/settings`) にアクセス。
2. **会社情報**: 社名を変更し、保存後に反映されるか確認。
3. **タブ切り替え**: 基本設定・メンバー・セキュリティのタブが機能するか確認。
4. **メンバー表示**: 現在ログインしているユーザーがリストに表示されているか確認。
5. **製造業タブ**: タブが存在し、クリックすると「プラグイン設定」などの表示（または空の状態）になること。
