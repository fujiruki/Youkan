# Detailed Design: Server-Side Cloudification (v1.0)

**Status**: Planning
**Date**: 2026-01-22
**Author**: AI Agent

---

## 1. System Architecture
### 1.1 Overview
- **Frontend**: React (SPA). Switches from `Dexie.js` (IndexedDB) to `ApiClient` (REST API) for business data.
- **Backend**: Native PHP (Lightweight Framework).
- **Database**: SQLite (Single file `jbwos.sqlite` for MVP, scalable to MySQL later).
- **Authentication**: JWT (JSON Web Token) with Tenant Scoping.

### 1.2 "Online-First" Philosophy
- **Read**: Live fetch from API. Short-term caching via `SWR` or `TanStack Query`.
- **Write**: Direct API calls. Optimistic UI updates.
- **Offline**:
    - **Read**: Service Worker catches API responses (stale-while-revalidate).
    - **Write**: Blocked (User showed alert "Offline"). No complex sync queue to prevent conflicts.

---

## 2. Database Schema (SQLite)

### 2.1 Identity & Access
**Script**: `migrate_v7_cloud_tables.php`

#### `users`
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | TEXT (UUID) | PK |
| `email` | TEXT | UNIQUE, Login ID |
| `password_hash` | TEXT | `password_hash($pw, PASSWORD_DEFAULT)` |
| `display_name` | TEXT | e.g. "Door Fujita" |
| `created_at` | INTEGER | Unix Timestamp |

#### `tenants`
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | TEXT (UUID) | PK |
| `name` | TEXT | e.g. "Tategu Design Studio" |
| `domain` | TEXT | Optional (e.g. "tategu.com") |
| `created_at` | INTEGER | Unix Timestamp |

#### `memberships`
| Column | Type | Description |
| :--- | :--- | :--- |
| `user_id` | TEXT | FK -> users.id |
| `tenant_id` | TEXT | FK -> tenants.id |
| `role` | TEXT | 'owner' \| 'admin' \| 'member' |
| **PK** | | (user_id, tenant_id) |

#### `api_tokens` (For External Apps / Shortcuts)
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | TEXT | PK (UUID) |
| `user_id` | TEXT | FK -> users.id |
| `token` | TEXT | Unique Secret Key (e.g. `sk_live_...`) |
| `label` | TEXT | e.g. "My iPhone" |
| `created_at` | INTEGER | |
| `last_used_at` | INTEGER | |

### 2.2 Manufacturing Data (Tenant Scoped)
**Warning**: `projects` table created in v6 is a prototype. `v7` migration will **DROP** and recreate it to match the robust Frontend schema.

#### `projects` (Re-defined)
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | TEXT (UUID) | PK |
| `tenant_id` | TEXT | FK -> tenants.id (**REQUIRED**) |
| `name` | TEXT | Project Name |
| `client` | TEXT | Client Name |
| `settings_json` | TEXT | JSON (Estimation Params) |
| `dxf_config_json` | TEXT | JSON (Layer Config) |
| `view_mode` | TEXT | 'internal' \| 'external' |
| `judgment_status` | TEXT | 'inbox' etc. |
| `created_at` | INTEGER | |
| `updated_at` | INTEGER | |

#### `doors`
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | TEXT (UUID) | PK |
| `tenant_id` | TEXT | FK -> tenants.id |
| `project_id` | TEXT | FK -> projects.id |
| `tag` | TEXT | "AD-1" etc. |
| `name` | TEXT | "Living Door" |
| `dimensions_json` | TEXT | JSON (w, h, d...) |
| `specs_json` | TEXT | JSON (Material, Glass...) |
| `count` | INTEGER | Quantity |
| `thumbnail_url` | TEXT | `/uploads/xyz.jpg` |
| `status` | TEXT | 'design' \| 'production' |
| `created_at` | INTEGER | |
| `updated_at` | INTEGER | |

---

## 3. API Specification

### 3.1 Authentication
**Header**: `Authorization: Bearer <JWT_TOKEN>`

#### `POST /api/auth/login`
- **Request**: `{ "email": "...", "password": "..." }`
- **Response**:
  ```json
  {
    "token": "eyJ...",
    "user": { "id": "...", "name": "..." },
    "tenant": { "id": "...", "name": "..." }
  }
  ```

#### `POST /api/auth/register` (Initial Phase)
- Allows creating a User + New Tenant.

### 3.2 Projects (Scoped)
All endpoints strictly filter by `WHERE tenant_id = ?` extracted from JWT.

#### `GET /api/projects`
- **Response**: Array of Project objects.

#### `POST /api/projects`
- **Request**: `{ "name": "...", ... }`
- **Server Logic**:
  1. Validate JWT.
  2. `$tenant_id = $jwt->tenant_id`.
  3. `INSERT INTO projects (..., tenant_id) VALUES (..., $tenant_id)`.

#### `PUT /api/projects/:id`
- **Server Logic**:
  `UPDATE projects SET ... WHERE id = ? AND tenant_id = ?`.

#### `DELETE /api/projects/:id`
- **Server Logic**:
  `DELETE FROM projects WHERE id = ? AND tenant_id = ?`.

### 3.3 Doors, Deliverables
Same pattern as Projects.

### 3.4 File Upload
#### `POST /api/upload`
- **Auth**: Required.
- **File**: `multipart/form-data` key=`file`.
- **Server Logic**:
  1. Validate JWT.
  2. Generate UUID filename.
  3. Save to `backend/storage/uploads/YYYY/MM/`.
  4. Return public URL.

### 3.5 External Integrations (iPhone Shortcuts / Voice)
#### `POST /api/integrations/inbox`
- **Auth**: `Authorization: Bearer <API_TOKEN>` (Long-lived Token).
- **Request**: `{ "title": "...", "memo": "..." }`
- **Server Logic**:
  1. Find User by Token.
  2. Find Default Tenant for User.
  3. `INSERT INTO items (id, title, status, ...) VALUES (..., 'inbox', ...)`
     *Note: Uses the core `items` table or `projects` table depending on where Inbox lives. Assuming core access.*

---

## 4. Migration Tool Logic (Frontend)
A special React Component `MigrationWizard` will be built.

### Step 1: Login / Setup
- User enters Email/Password to create an account on the new Server.
- Server creates User + Tenant.
- Client stores JWT.

### Step 2: Data Preparation
- `Dexie.projects.toArray()` -> Load all local projects.
- `Dexie.doors.toArray()` -> Load all local doors.

### Step 3: Transformation
- Loop through Projects:
  - Generate new UUID `newId`.
  - Store mapping `Map<OldDetailsId, NewUUID>`.
  - Prepare payload.
- Loop through Doors:
  - Replace `projectId` (Number) with `Map[oldProjectId]`.
  - Prepare payload.

### Step 4: Upload (Batch)
- Send `POST /api/migrate/batch_import` (Special endpoint for speed).
- Or loop `POST /api/projects`, `POST /api/doors` (Slower but safer).
- **Decision**: Use **Batch Endpoint** for atomicity (Transaction).

### Step 5: Verification & Switch
- Fetch `GET /api/projects`. Compare counts.
- Set LocalStorage flag `USE_CLOUD_API = true`.
- Reload App.

---

## 5. Development Steps

1.  **Backend Core**
    - `AuthController.php`, `JWTService.php`.
    - `migrate_v7.php`.
    - `BaseController.php` (middleware for Auth).

2.  **Resource Controllers**
    - `ProjectController.php`, `DoorController.php`.
    - Implement `verifyTenant($tenant_id)` method.

3.  **Frontend Auth**
    - `AuthProvider.tsx` (Context).
    - `LoginForm.tsx`.

4.  **Migration Wizard**
    - `MigrationScreen.tsx`.

5.  **Refactoring Repositories**
    - `JBWOSRepository` -> calls `ApiClient`.
    - `DoorRepository` (New) -> calls `ApiClient`.

---
**Approval**: This design enables the "Global JBWOS" vision while solving the immediate "Multi-device" need.
