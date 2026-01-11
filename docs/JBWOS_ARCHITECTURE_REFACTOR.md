# JBWOS Core Architecture: Decoupling Strategy

## 目的
JBWOS（Judgment-Based Work Operating System）の「判断管理ロジック」を、特定のドメイン（建具）から切り離し、汎用的に利用可能な「判断エンジン（Judgment Engine）」として再定義する。これにより将来的な他業界への展開（プラグイン化）を可能にする。

## アーキテクチャ概要

### 1. JBWOS Core (Domain Agnostic)
- **依存性**: 建具ドメイン（Door, Project）を知らない。
- **管理対象**: `JudgableItem` インターフェースのみ。
- **責務**:
    - Inbox/Ready/Waiting/Pending のバケツ管理。
    - リミット制限（Ready Max 2）。
    - 思考停止防止（Inbox Overflow）。
    - マイクロコピーの提供。

```typescript
// Core Interface
export interface JudgableItem {
    id: string | number;
    title: string;
    status: 'inbox' | 'ready' | 'waiting' | 'pending' | 'done';
    
    // Optional metadata for display, but not logic
    displayTags?: string[]; // e.g., ["Project A", "Urgent"]
    metadata?: Record<string, any>;
}

export interface JudgmentEngine {
    items: JudgableItem[];
    canMoveToReady(): boolean;
    move(id: string | number, to: 'ready' | 'waiting' | ...): void;
}
```

### 2. Tategu Adapter (Domain Specific)
- **依存性**: JBWOS Core と Tategu DB の両方を知っている。
- **責務**:
    - `Door` や `Project` データを `JudgableItem` に変換（Map）して Core に渡す。
    - Core からの操作（moveなど）を、実際の DB 操作（`db.doors.update`）に変換する。

```typescript
// Adapter Logic
class TateguJudgmentAdapter {
    toJudgable(door: Door, project: Project): JudgableItem {
        return {
            id: door.id,
            title: door.name,
            status: mapToCoreStatus(door.judgmentStatus),
            displayTags: [project.name]
        };
    }
}
```

### 3. View Layer
- `GlobalDecisionBoard` コンポーネントは `JBWOS Core` のデータのみを表示する。
- これにより、UIも完全に汎用化され、どの業界用にもそのまま使えるようになる。

## 修正プラン
1. `src/domain/jbwos/` ディレクトリを作成し、ここに Core ロジックを移動。
2. `useGlobalBoardViewModel` を `useJBWOS`（汎用）と `useTateguBoardAdapter`（特化）に分離。
3. `implementation_plan.md` をこのアーキテクチャに合わせて更新。
