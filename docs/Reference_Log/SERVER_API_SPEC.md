# JBWOS Server API Specification

## Overview
- **Base URL**: `/api`
- **Format**: JSON
- **Auth**: TBD (MVP: None or Shared Secret Header)

## Architecture
Simple RESTful API interfacing with SQLite.

## Endpoints

### 1. Items (GDB Tasks)

#### GET /items
- **Description**: Fetch all items for the board.
- **Response**: `200 OK`
```json
[
  {
    "id": "uuid",
    "title": "Task 1",
    "status": "inbox",
    "statusUpdatedAt": 1700000000,
    "createdAt": 1700000000,
    "updatedAt": 1700000000,
    "memo": "Some memo"
  }
]
```

#### POST /items
- **Description**: Create a new item (Throw in).
- **Body**: `{ "title": "New Task" }`
- **Response**: `201 Created` with generated ID.

#### PUT /items/:id
- **Description**: Update item status or title.
- **Body**: `{ "status": "ready", "title": "Updated Title" }` (Partial update allowed)
- **Response**: `200 OK`

#### DELETE /items/:id
- **Description**: Delete an item.
- **Response**: `204 No Content`

### 2. Doors (Tategu Integration)
*Note: Depending on architecture, Doors might be synched or just linked.*
For MVP, if Doors are managed in the same SQLite DB:

#### GET /doors
- **Description**: Fetch all registered doors.

### 3. Debugging (AI Eyes)

#### GET /debug/logs
- **Description**: Read server-side `error.log`.
- **Response**: `200 OK` (Text or JSON)

#### POST /debug/logs
- **Description**: Send frontend logs to server for persistent storage.
- **Body**: `{ "level": "error", "message": "JS Error...", "stack": "..." }`

## Database Schema (SQLite)

### Table: `items`
| Column | Type | Notes |
| :--- | :--- | :--- |
| id | TEXT | UUID (Primary Key) |
| title | TEXT | |
| status | TEXT | inbox, ready, etc. |
| status_updated_at | INTEGER | Timestamp |
| created_at | INTEGER | Timestamp |
| updated_at | INTEGER | Timestamp |
| memo | TEXT | |
| interrupt | INTEGER | 0 or 1 |
| sort_order | INTEGER | For custom sorting |

### Table: `logs`
| Column | Type | Notes |
| :--- | :--- | :--- |
| id | INTEGER | Auto Increment |
| level | TEXT | error, info, debug |
| source | TEXT | client, server |
| message | TEXT | |
| created_at | INTEGER | Timestamp |
