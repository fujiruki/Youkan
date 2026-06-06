# R-044 起動時 API 重複発火 — 調査と統合方針

調査日: 2026-06-06
ブランチ: `feature/R-044-api-dedup`
worktree: `C:/Fujiruki/Projects/Youkan/.claude/worktrees/agent-a49e781a3c88226ff`

## 計測結果（Before）

chrome-devtools MCP の 2026-06-06 計測で次の重複が確認された。

| Endpoint | 発火回数 | 備考 |
|:--|--:|:--|
| `GET /auth/me` | 3 | AuthProvider + DashboardScreen の VM + PanoramaBoard の VM |
| `GET /items?scope=aggregated` | 2 | DashboardScreen の VM + PanoramaBoard の VM |
| `GET /health` | 2 | HealthCheck コンポーネントの初期マウント揺れ（StrictMode 影響を含む） |

`<React.StrictMode>` は `JWCADTategu.Web/src/main.tsx:11` にあるが React 18 では本番では noop なのでこの計測の本質は構造的な二重発火である。

## 呼び出し元の特定

### `/auth/me`

1. **AuthProvider.checkAuth** (`JWCADTategu.Web/src/features/core/auth/providers/AuthProvider.tsx:27,75,109-111`)
   - 初回マウント時の `useEffect(() => { checkAuth(); }, [])` で 1 回
   - `AuthService.getInstance().me()` 経由
2. **useYoukanViewModel.refreshContextMetadata** (`JWCADTategu.Web/src/features/core/youkan/viewmodels/useYoukanViewModel.ts:218`)
   - `getRepository().getJoinedTenants()` → `CloudYoukanRepository.getJoinedTenants` (`...repositories/CloudYoukanRepository.ts:216-218`) → `ApiClient.getJoinedTenants()` (`src/api/client.ts:196-199`) で `/auth/me` を叩く
   - `refreshAll` から呼ばれる
3. **useYoukanViewModel が 2 箇所でマウントされる**
   - `DashboardScreen` (`...screens/DashboardScreen.tsx:62`)
   - `PanoramaBoard` (`...components/PanoramaBoard/PanoramaBoard.tsx:55`)
   - 初期 viewMode が `'panorama'` のときは両方が同時にレンダリングされる（DashboardScreen が PanoramaBoard を子としてレンダリングする構造）
   - 2 つの VM がそれぞれ `refreshAll` を呼び `getJoinedTenants` で `/auth/me` を 2 回叩く
   - 合計: **AuthProvider 1 + VM x 2 = 3 回**

### `/items?scope=aggregated`

1. **useYoukanViewModel.refreshGdb** → `CloudYoukanRepository.getGdbShelf` (`...CloudYoukanRepository.ts:46-65`) は `ApiClient.getAllItems({ scope: resolvedScope, ... })` を呼ぶ
   - 当該 VM は前述の通り DashboardScreen と PanoramaBoard で 2 個立ち上がるため、`refreshAll` がそれぞれ走り `/items?scope=aggregated`（または `dashboard`）が 2 回叩かれる
   - 合計: **2 回**

### `/health`

1. **HealthCheck** (`JWCADTategu.Web/src/features/core/youkan/components/Layout/HealthCheck.tsx:24-29`)
   - マウント時に `checkHealth()` を 1 回、その後 30 秒ごとに polling
   - dev では StrictMode によるダブルマウントで 2 回発火する可能性がある
   - 本番でも初期描画タイミング次第で 2 回観測される

## 根本原因のサマリ

1. **`useYoukanViewModel` の VM がコンポーネント毎にそれぞれ独立 fetch する**
   - DashboardScreen と PanoramaBoard が**それぞれ独立した VM インスタンス**を持つため、起動時データ取得が二重化
   - これが `/auth/me` と `/items` の各 1 件分の重複の主因
2. **AuthProvider と VM の `getJoinedTenants` が同じ `/auth/me` を独立に叩く**
   - AuthProvider が既に `joinedTenants` を Context に持っているのに、VM が再フェッチしている
   - これが `/auth/me` の 1 件分余計な重複の主因
3. **HealthCheck のマウント揺れ**

## 統合方針

### 方針 A: AuthProvider 起点の単一ソース化（採用）

- `/auth/me` は **AuthProvider が 1 回だけ**叩き、`user / tenant / joinedTenants` を Context に保持
- `useYoukanViewModel.refreshContextMetadata` の `getJoinedTenants()` 呼び出しを撤廃し、AuthContext の `joinedTenants` を直接参照する
  - 既に `App.tsx:378` で `useAuth()` から `joinedTenants` を取り出して `AppContent` で使っている。`useYoukanViewModel` 側も `useAuth()` を呼ぶ形に統一する
- これで `/auth/me` の VM 側からの呼び出しがゼロになる

### 方針 B: ApiClient レベルの in-flight dedup（補強）

- 同一 path への GET リクエストが同時に飛んだ場合、後発を先発の Promise に乗せる「in-flight dedup」を `ApiClient.request` に実装
- これで構造的に 2 つの VM が並行するケースや HealthCheck の二重マウントを **1 回の HTTP fetch にまとめる**
- 副作用がない GET のみが対象。短いウィンドウ（同時 in-flight 中のみ）に限定するため、データの鮮度には影響しない
- レスポンスは clone() してから JSON 化することで複数の呼び出し元に独立配信する

### 採用する組合せ

**A + B を併用**する:
- A により、設計上の重複（VM が独立に AuthProvider 情報を再取得）を排除
- B により、構造的に 2 つの VM が並行するケースや HealthCheck の二重マウントを吸収

これにより、起動時の各 endpoint が 1 回に収まる。

## 変更ファイル

1. `JWCADTategu.Web/src/api/client.ts`
   - GET の in-flight dedup を `ApiClient.request` に追加
2. `JWCADTategu.Web/src/features/core/youkan/viewmodels/useYoukanViewModel.ts`
   - `refreshContextMetadata` で `getJoinedTenants` を呼ばず、`useAuth()` から `joinedTenants` を取得
3. テスト
   - `JWCADTategu.Web/src/api/__tests__/client.dedup.test.ts` を追加（in-flight dedup の TDD）

## 期待結果（After）

| Endpoint | Before | After |
|:--|--:|--:|
| `/auth/me` | 3 | **1** |
| `/items?scope=aggregated` | 2 | **1** |
| `/health` | 2 | **1** |
