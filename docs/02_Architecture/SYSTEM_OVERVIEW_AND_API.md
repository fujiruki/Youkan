# System Architecture & API Specification

## 1. System Overview

TateguDesignStudio (JBWOS) is a task management system designed for sash and door manufacturing (Tategu).
It consists of a **Single Page Application (SPA)** frontend and a **Lightweight PHP API** backend with SQLite.

### Technology Stack
- **Frontend**: React, TypeScript, Vite, Tailwind CSS
- **Backend**: PHP 8.x (Vanilla), SQLite 3
- **Infrastructure**: ConoHa Wing (Shared Hosting), Apache/Nginx

---

## 2. API Communication Specification (Crucial)

To ensure stability on the production environment (ConoHa Wing WAF), the following communication rules **MUST** be strictly followed.

### 2.1 Authentication
- **Method**: Bearer Token (JWT) in `Authorization` Header.
- **Prohibited**: Do NOT pass tokens via URL query parameters (e.g., `?token=...`). This triggers WAF blocks (403 Forbidden).
    - *Exception*: File downloads (e.g., backup export) where headers cannot be set may use URL tokens, but strictly for GET requests.

### 2.2 HTTP Methods & WAF Avoidance
The WAF blocks certain standard HTTP methods and patterns. The `ApiClient` wrapper handles this automatically.

- **GET / POST**: Allowed.
- **PUT / DELETE**: Often blocked.
    - **Solution**: Send as `POST` with header `X-HTTP-Method-Override: PUT` (or DELETE).
- **PATCH**: **Strictly Prohibited**.
    - **Solution**: Use `PUT` (`ApiClient.updateItem`) instead. Do NOT use `PATCH` even if using Method Override, as the intent itself might be flagged or handled inconsistently.

### 2.3 API Client Wrapper
Always use `src/api/client.ts` (`ApiClient` class) for requests. It encapsulates:
- Auth Header injection
- Method Override logic
- Error handling and Logging

```typescript
// Good
await ApiClient.updateItem(id, { title: 'New Title' });

// Bad
await fetch(`/api/items/${id}`, { method: 'PATCH', ... });
```

---

## 3. Backend Architecture

### 3.1 Routing (`index.php`)
- Single entry point (`index.php`) handles all requests.
- Uses Regex matching on `PATH_INFO` or `REQUEST_URI` to dispatch to Controllers.
- **Robustness**: Automatically strips prefixes like `/api` or script paths to ensure consistent routing across Local/Dev/Prod environments.

### 3.2 Controllers
- **BaseController**:
    - Handles Authentication (JWT Parsing).
    - **Self-Healing Schema**: Automatically adds missing columns (e.g., `updated_at`) to standard tables (`users`, `items`) if they trigger errors.
    - Provides `updateEntity` helper for consistent SQL generation.
- **DecisionController**:
    - Encapsulates "Decision" logic (Yes/Hold/No).
    - Ensures **DecisionLogs** are written to the database whenever a status changes.
    - Frontend MUST use `POST /decision/{id}/resolve` instead of updating status manually.

---

## 4. Frontend Architecture

### 4.1 ViewModel Pattern
- Business logic is concentrated in **Custom Hooks (ViewModels)** (e.g., `useJBWOSViewModel`).
- Components (View) should trigger **Intent-based methods** on the ViewModel (e.g., `vm.resolveDecision(...)`) rather than calling API directly.

### 4.2 State Management
- **Optimistic UI**: ViewModels update local state immediately for responsiveness, then synchronize with the server.
- **Global Events**: Uses `window.dispatchEvent` for cross-component notification (e.g., `jbwos-capacity-update`).

---

## 5. Development Workflow

### 5.1 Deployment
- Use `upload.ps1` at project root.
- It builds the React app (`npm run build`) and uploads both Frontend logic and Backend PHP files to the server via FTP (WinSCP).

### 5.2 Local Development
- **Frontend**: `npm run dev` (Vite Server)
- **Backend**: `backend/start-server.ps1` (PHP Built-in Server on localhost:8000)
- **Proxy**: Vite proxies `/api` requests to `localhost:8000`.

---

## 6. Key Data Models

### 6.1 Users
- Stored in `users` table.
- Includes `daily_capacity_minutes`, `preferences` (JSON), `updated_at`.

### 6.2 Items
- Core entity for Tasks/Projects.
- Statuses: `inbox`, `focus` (Candidate), `confirmed` (Today Commit), `pending`, `done`.
- **Project Structure**: `items` table has `parent_id` for Subtasks.
