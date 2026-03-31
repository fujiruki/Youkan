# Cloud Transition Design Document (Rev.2)

## 1. Philosophy & Goals
*   **Normalized Architecture**: Avoid "JSON dumping". Critical master data (`Assignees`, `Categories`) must be strictly typed and relationally stored to allow future analytics and constraints.
*   **Repository Pattern**: Frontend data access must be decoupled from UI logic. Replace Singleton Managers with Repositories (`IAssigneeRepository`, etc.) to enable **TDD** (Mocking) and clear **MVVM** separation.
*   **Single Source of Truth**: The Backend Database (SQLite) is the master. LocalStorage is deprecated.

## 2. Database Schema (Normalized)

### 2.1 Master Data Tables
Instead of a JSON blob, we define proper tables linked to Tenants.

```sql
-- Assignees (Master)
CREATE TABLE assignees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'external', -- 'internal', 'external'
    email TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

-- Project Categories (Master)
CREATE TABLE project_categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id TEXT NOT NULL,
    name TEXT NOT NULL,
    icon TEXT,
    domain TEXT DEFAULT 'general',
    is_custom INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);
```

### 2.2 Transaction/Log Tables

```sql
-- Life Logs (Daily Check)
CREATE TABLE life_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    item_id TEXT NOT NULL, -- 'clean', 'rest', or custom ID
    checked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX idx_life_logs_user_date ON life_logs(user_id, checked_at);
```

### 2.3 User Preferences (JSON)
Only purely UI-related preferences remain in JSON.

```sql
ALTER TABLE users ADD COLUMN preferences TEXT DEFAULT '{}';
-- Example: { "ui": { "panoramaCols": 3, "theme": "dark" } }
```

---

## 3. Frontend Architecture (MVVM + Repository)

### 3.1 Abstraction Layer (Repositories)
Define Interfaces to allow TDD (swapping Real/Mock implementation).

```typescript
// features/core/jbwos/domain/IAssigneeRepository.ts
export interface IAssigneeRepository {
    getAll(): Promise<Assignee[]>;
    add(assignee: Omit<Assignee, 'id'>): Promise<Assignee>;
    delete(id: string): Promise<void>;
}

// features/core/jbwos/repositories/AssigneeRepository.ts
export class AssigneeRepository implements IAssigneeRepository {
    async getAll(): Promise<Assignee[]> {
        return ApiClient.getAssignees(); // Calls /api/assignees
    }
    // ...
}
```

### 3.2 ViewModel Integration
The ViewModel owns the Repository instance (Dependency Injection via Constructor or Hook).

```typescript
const useJBWOSViewModel = () => {
    // In real app, derived from Context or DI container
    const assigneeRepo = useMemo(() => new AssigneeRepository(), []);
    
    // Logic uses repo, not localStorage directly
    const addAssignee = async (data) => {
        await assigneeRepo.add(data);
    };
}
```

## 4. Implementation Steps

1.  **Backend Migration**: Create tables (`assignees`, `project_categories`, `life_logs`) and update `users` table.
2.  **API Implementation**: Add standard CRUD Endpoints (`AssigneeController`, `CategoryController`, `LifeController`).
3.  **Frontend Refactoring**:
    - Create `IAssigneeRepository`, `IProjectCategoryRepository`.
    - Implement `AssigneeRepository` (API-based).
    - Refactor `useJBWOSViewModel` and `TateguPlugin` to use Repositories.
    - **Delete** `AssigneeManager.ts` and `ProjectCategoryManager.ts`.

## 5. UI Fix (FutureBoard)
- **MenuDrawer**: Fix Z-Index context to ensure overlay works.
