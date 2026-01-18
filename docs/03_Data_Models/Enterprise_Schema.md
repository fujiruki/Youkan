# JBWOS Enterprise Data Schema
Version: 1.0
Date: 2026-01-18

This document defines the data schema for the JBWOS Enterprise features ("Company Brain").

## 1. Overview
The Enterprise architecture introduces 4 new entities:
1.  **Stocks**: Unassigned jobs (pool).
2.  **Projects**: High-level groups of tasks/stocks.
3.  **UserConfigs**: Per-user capacity and settings.
4.  **DailyVolumes**: Aggregated workload metrics per user/day.

## 2. Table Definitions

### 2.1 `stocks` (Unassigned Job Pool)
Stores jobs that are estimated but not yet assigned to any specific user's calendar (Inbox).

| Column | Type | Default | Description |
|---|---|---|---|
| `id` | TEXT (PK) | - | UUID |
| `title` | TEXT | NOT NULL | Job title |
| `project_id` | TEXT | NULL | Link to `projects.id` |
| `estimated_minutes` | INTEGER | 0 | Workload weight |
| `due_date` | TEXT | NULL | Desired completion date (YYYY-MM-DD) |
| `status` | TEXT | 'open' | 'open', 'assigned', 'archived' |
| `created_at` | INTEGER | - | Timestamp |

### 2.2 `projects` (Project Monitor)
Represents a collection of tasks and stocks. Used for "Project Monitor" progress bars.

| Column | Type | Default | Description |
|---|---|---|---|
| `id` | TEXT (PK) | - | UUID (Deliverable ID for Tategu) |
| `title` | TEXT | NOT NULL | Project Name |
| `status` | TEXT | 'active' | 'active', 'completed', 'on_hold' |
| `progress_rate` | INTEGER | 0 | Cached progress % (0-100) |
| `total_weight` | INTEGER | 0 | Total estimated minutes |
| `current_weight` | INTEGER | 0 | Remaining estimated minutes |
| `created_at` | INTEGER | - | Timestamp |

### 2.3 `user_configs` (Individual Settings)
Stores capacity settings for each user.

| Column | Type | Default | Description |
|---|---|---|---|
| `user_id` | TEXT (PK) | - | Unique User ID |
| `daily_capacity_minutes`| INTEGER | 480 | Default 8 hours (480 min) |
| `work_cal_id` | TEXT | NULL | Google Calendar ID for Work |
| `private_cal_id` | TEXT | NULL | Google Calendar ID for Private |

### 2.4 `daily_volumes` (Aggregated Heatmap Data)
Stores the daily workload volume for heatmap visualization.
This table is updated (upserted) whenever a user modifies their tasks.

| Column | Type | Default | Description |
|---|---|---|---|
| `user_id` | TEXT | - | Part of PK |
| `date` | TEXT | - | Part of PK (YYYY-MM-DD) |
| `total_minutes` | INTEGER | 0 | Sum of task weights |
| `capacity_minutes`| INTEGER | 480 | Effective capacity for that day |
| **PRIMARY KEY** | `(user_id, date)` | | Composite Key |

## 3. Implementation Strategy (SQLite)
Since we use SQLite via PHP PDO:
- Create `backend/migrate_v6_enterprise.php` to execute the `CREATE TABLE` statements.
- Update `backend/db.php`'s `initDB` function to include these tables for new installations.

## 4. Relationship with Tategu Plugin
- **Tategu Creation**:
    - Creates a `Door` record.
    - Creates a `Deliverable` (Project) record.
    - **New**: Instead of creating a `Task` in Items immediately, create a `Stock` record.
    - **Linking**: `stocks.project_id` -> `deliverable.id` (or `projects.id`).
