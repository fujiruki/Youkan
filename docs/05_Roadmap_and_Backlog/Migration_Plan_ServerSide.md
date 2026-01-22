# Server-Side Migration Plan (Cloudification)

**Status**: Draft
**Author**: AI Agent
**Date**: 2026-01-22
**Purpose**: Achieve "Operate the same data from PC and Smartphone" by migrating local browser data to the server.

---

## 1. Objective Concept
Current architecture is **Hybrid**:
- **JBWOS Tasks (Items)**: Synced via Server (Accessible everywhere).
- **Manufacturing Data (Projects/Doors)**: Local Browser only (PC specific).

To enable multi-device usage (PC, Smartphone, Tablet), all business-critical data must reside on the server. The server becomes the **Single Source of Truth (SSOT)**.

### Philosophy Alignment
- **Constitution**: "User Agency" - The user owns their data. Centralized storage enables better backup and accessibility.
- **Privacy**: Access control must be strict (as per AI Conference logs).

---

## 2. Target Data for Migration
The following Dexie (IndexedDB) tables will be migrated to server-side SQLite tables.

| Table Name | Description | Migration Strategy |
| :--- | :--- | :--- |
| `projects` | Estimation Project details | **Migrate to SQL** |
| `doors` | Door specifications & Dimensions | **Migrate to SQL** |
| `deliverables` | Manufacturing deliverables | **Migrate to SQL** |
| `doorPhotos` | Images (Blobs) | **Migrate to File Storage** (saving path in DB) |
| `catalog` | Master data | **Migrate to SQL** (or Static JSON if read-only) |
| `settings` | User app settings | **Migrate to SQL** (`user_configs` table) |

---

## 3. Database Schema Design (SQLite)

### 3.0 Identity & Access Management (New Layer)
Based on "World JBWOS" vision.

#### `users` (Global Identity)
```sql
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY, -- UUID
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    display_name TEXT,
    created_at INTEGER
);
```

#### `tenants` (Organizations / Contexts)
```sql
CREATE TABLE IF NOT EXISTS tenants (
    id TEXT PRIMARY KEY, -- UUID
    name TEXT NOT NULL, -- e.g. "Tategu Design Studio"
    domain TEXT, -- e.g. "door-fujita.com"
    created_at INTEGER
);
```

#### `memberships` (User-Tenant Relation)
```sql
CREATE TABLE IF NOT EXISTS memberships (
    user_id TEXT,
    tenant_id TEXT,
    role TEXT DEFAULT 'member', -- 'owner', 'admin', 'member'
    PRIMARY KEY (user_id, tenant_id)
);
```

### 3.1 Business Data Tables (Tenant Scoped)
All business data MUST belong to a Tenant.

#### `projects` (Manufacturing Context)
*Note: Distinct from `items` (which represents the generic Task/Folder).*
```sql
CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY, -- UUID
    tenant_id TEXT NOT NULL, -- [NEW] Multi-tenant isolation
    name TEXT NOT NULL,
    client TEXT,
    settings_json TEXT, -- JSON: EstimationSettings
    dxf_config_json TEXT, -- JSON: DxfLayerConfig
    is_archived INTEGER DEFAULT 0,
    view_mode TEXT DEFAULT 'internal',
    judgment_status TEXT DEFAULT 'inbox',
    created_at INTEGER,
    updated_at INTEGER,
    FOREIGN KEY(tenant_id) REFERENCES tenants(id)
);
```
*Migration Note*: Dexie IDs are numbers `++id`. We should switch to UUIDs for reliable syncing.
Migration Strategy: 
1. Create Default Tenant "Tategu Design Studio".
2. Create Default User (Admin).
3. Import all local projects and link to Default Tenant.

#### `doors` (Component Details)
```sql
CREATE TABLE IF NOT EXISTS doors (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL, -- [NEW]
    project_id TEXT, -- Foreign Key to projects.id
    deliverable_id TEXT, -- Foreign Key to deliverables.id
    tag TEXT, -- e.g. "AD-1"
    name TEXT,
    dimensions_json TEXT, -- JSON: DoorDimensions
    specs_json TEXT, -- JSON: Record<string, any>
    count INTEGER DEFAULT 1,
    thumbnail_url TEXT, -- Path to stored image
    
    -- Schedule / Status
    status TEXT, -- 'design', 'production', 'completed'
    man_hours REAL,
    complexity REAL,
    start_date TEXT,
    due_date TEXT,
    
    -- Generic / Manufacturing
    category TEXT,
    generic_specs_json TEXT, -- JSON
    
    -- Constitution / Kanban
    judgment_status TEXT,
    waiting_reason TEXT,
    weight INTEGER,
    rough_timing TEXT,
    
    created_at INTEGER,
    updated_at INTEGER
);
```

#### `deliverables` (Production Units)
```sql
CREATE TABLE IF NOT EXISTS deliverables (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL, -- [NEW]
    project_id TEXT, -- Link to JBWOS Item (Parent Project)
    linked_item_id TEXT, -- Link to JBWOS Item (Auto-generated task)
    name TEXT,
    type TEXT, -- 'product' | 'service'
    status TEXT,
    
    -- Estimates & Costs
    estimated_work_minutes INTEGER,
    estimated_site_minutes INTEGER,
    actual_work_minutes INTEGER,
    actual_site_minutes INTEGER,
    cost_json TEXT, -- JSON: Material, Labor, etc.
    
    requires_site_installation INTEGER,
    description TEXT,
    note TEXT,
    
    created_at INTEGER,
    updated_at INTEGER
);
```

### 3.2 File Storage (Photos)
Instead of storing BLOBs in SQLite:
1.  **Upload API**: `POST /api/upload` -> Key-Value response `{ "url": "/uploads/2026/01/uuid.jpg" }`.
2.  **Storage**: Files saved in `backend/storage/uploads/`.
3.  **DB**: Store potential URL in `thumbnail_url`.

---

## 4. API Architecture

### 4.1 Endpoints
RESTful API standard.

- `GET  /api/projects` (List)
- `POST /api/projects` (Create)
- `GET  /api/projects/:id` (Detail)
- `PUT  /api/projects/:id` (Update)
- `DELETE /api/projects/:id` (Delete)

*Same pattern for `/api/doors` and `/api/deliverables`.*

- `POST /api/upload` (Multipart form data)

### 4.2 Sync Strategy
**Online-First + JWT Auth**
1.  **Login**: User logs in -> Server returns JWT (containing `user_id` & `tenant_id`).
2.  **API Requests**: Client sends JWT in Header.
3.  **Server**: Backend checks `tenant_id` scope for every request. `SELECT * FROM projects WHERE tenant_id = ?`.

---

## 5. Migration Roadmap

### Phase 1: Foundation (Day 1)
- [ ] Create `migrate_v7_cloud_tables.php` (Users, Tenants, Memberships).
- [ ] Implement `AuthController` (Login, Register).
- [ ] Implement `ProjectController` etc. with Tenant Scoping.

### Phase 2: Data Migration Tool (Day 2)
- [ ] Create a client-side utility in React:
    1. **Login** to Server first.
    2. Read all data from Dexie.
    3. Convert IDs to UUIDs.
    4. `POST` dump to Server API (Server auto-assigns current `tenant_id`).

### Phase 3: Frontend Switch (Day 3)
- [ ] Create `LoginScreen`.
- [ ] Refactor `ApiClient` to store/send Token.
- [ ] Refactor `JBWOSRepository` to use authenticated API endpoints.

### Phase 4: Verification (Day 4)
- [ ] Verify Login/Logout.
- [ ] Verify Data Isolation (Tenant A cannot see Tenant B's data).

---

## 6. Risks & Mitigation

1.  **Performance**: Fetching 1000 doors via API vs Local DB.
    - *Mitigation*: Pagination and efficient SQL queries (Indexing).
2.  **ID Conflict**: Dexie uses auto-increment numbers. Server might collide or become confusing.
    - *Decision*: Convert existing Numbers to String-Strings ("1", "2") or fully regenerate UUIDs during migration?
    - *Proposal*: Keep current IDs as strings during migration to preserve relations. Future items get UUIDs.
3.  **Image Upload Size**: Large data transfer.
    - *Mitigation*: Resize images on client-side canvas before uploading.

---
**Review Required**:
- Does "Online-First" alignment fit the user's "Constitution"? (Constitution says "Speed" < "Certainty").
- Is the schema sufficient for all current features?
