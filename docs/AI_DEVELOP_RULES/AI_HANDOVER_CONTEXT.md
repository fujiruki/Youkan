# AI HANDOVER CONTEXT
> **Updated**: 2026-01-12
> **Author**: Antigravity (Agent)

## 🚨 CRITICAL ENVIRONMENT CONSTRAINTS (MUST READ)

### 1. Windows PowerShell & npm
- **Issue**: PowerShell Execution Policy restricts running scripts (e.g., `npm.ps1`).
- **RULE**: **ALWAYS use `npm.cmd`** explicitly.
    - ❌ `npm run dev`
    - ✅ `npm.cmd run dev`
    - ✅ `npm.cmd install`

### 2. Vite Proxy vs PHP Backend (Windows)
- **Issue**: Vite's proxy (`/api` -> `localhost:8000`) is unreliable in the current local Windows environment (fails to route, returns HTML).
- **Workaround (Active)**: 
    - `src/api/client.ts` is configured to use **Direct URL** `http://localhost:8000`.
    - **Do NOT revert** to `/api` unless the proxy issue is fundamentally resolved.
    - CORS is handled/allowed by the backend.

---

## 🏗️ Project Architecture Snapshot

### Backend (Server-Side Migration Completed)
- **Language**: PHP (Built-in server @ `localhost:8000`)
- **Database**: SQLite (`backend/jbwos.sqlite`)
- **API Style**: RESTful JSON API
- **Endpoints**:
    - `GET /items`: Fetch all items
    - `POST /items`: Create item
    - `PUT /items/{id}`: Update item
    - `DELETE /items/{id}`: Delete item
- **Routing**: `route.php` handles routing.

### Frontend
- **Framework**: React + Vite (TypeScript)
- **State Management**: MVVM Pattern (`useJBWOSViewModel` view model, `JBWOSRepository` repository)
- **Data Stores (Hybrid)**:
    - **Items (Tasks/Jobs)**: **API (SQLite)** via `ApiClient`.
    - **Doors (Tategu)**: **IndexedDB** (Legacy/Client-side) via `DoorRepository`.
    - `JBWOSRepository` merges these sources for the ViewModel.

### Key Files
- `src/api/client.ts`: API interaction layer (Direct URL configured).
- `src/features/jbwos/repositories/JBWOSRepository.ts`: Singleton repository managing Items (API) and Doors (IndexedDB).
- `src/features/jbwos/viewmodels/useJBWOSViewModel.ts`: Main logic glue.

---

## 🐛 Current Known Issues / Active Tasks
1. **GDB Delete Bug**: Right-click delete in Global Decision Board is reported broken. (Next Priority)
2. **AI Debug Hook**: `/debug/logs` endpoint not yet implemented.

---

## 📜 Documentation Map
- **Rules**: `docs/AI_DEVELOP_RULES/` (Read `AI_DEVELOPMENT_OPS` for command rules).
- **Plan**: `implementation_plan.md` (Check for active plans).
- **Task**: `task.md` (Master checklist).
