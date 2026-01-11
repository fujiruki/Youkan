# Constitution-Based UI Specification: Global JBWOS (v2)

## 0. Introduction
This specification supersedes all previous UI specs.
**Core Paradigm Shift**:
- **OLD**: Project > Tasks (Vertical)
- **NEW**: **Ready (Today) > Tasks (Horizontal/Global)**

## 1. Application Architecture

### 1.1 Entry Point: The Global Decision Board (Internal View)
- **Role**: The Application Home Screen.
- **Scope**: Aggregates items from **ALL** projects.
- **Purpose**: Judgment Management (not Project Management).

### 1.2 View Separation
1.  **Internal View (Home)**:
    - Global Decision Board.
    - Focus: "My sanity today".
    - **No dates**. Max 2 items in Ready.
2.  **External View (Sub-screen)**:
    - Project List & Details.
    - Focus: "Explaining to others".
    - Adding items, Dxf export, Gantt charts.

## 2. Global Decision Board UI

### 2.1 The 4 Buckets (Global Scope & Constraints)
| Bucket | Query Logic | Meaning | UI Rule (Checklist) |
|---|---|---|---|
| **Inbox** | `status='inbox'` | Capture zone. | **Overwhelm Protection**: If items > 7, show banner: **"Select just 1 item from Inbox today."** |
| **Waiting** | `status='waiting'` | Blocked. | Explicit reasons required. |
| **Ready** | `status='ready'` | **The Sacred Zone.** | **Global Limit**: Max 2 items. **Focus Mode**: If Ready > 0, opacity of Inbox/Waiting reduces (50%). |
| **Pending** | `status='pending'` | Someday. | Folded by default. |

### 2.2 Card Design ('Global' Context)
- **Primary Text**: Item Name
- **Context Tag**: **Project Name** (Small badge)
- **Visuals**: Weight/Prox (Small dots/text) - *No sorting allowed.*

### 2.3 The "Done" Experience (Stopping)
- **Add to Ready**: Toast "Time to focus. This is enough for today."
- **Ready -> Done**: Toast "Good job."
- **Ready Empty**: **Large Centered Message: "You have finished for today."** (No "Next" button).

## 3. Workflow & Transitions

### 3.1 App Launch
- Opens **Global Decision Board**.
- User sees items from Project A, Project B, Project C mixed in Inbox/Ready.

### 3.2 "I need to add a new project/item"
1.  Click **"Projects / External Mode"** button.
2.   Transition to **Project List Screen**.
3.   Create Project / Open Project.
4.   Add Items (new items get `status='inbox'`).
5.  Return to Home (Global Board) -> New items appear in Global Inbox.

## 4. Technical Migration Overview

### 4.1 Component Shifts
- **`DashboardScreen`**:
    - **Current**: List of Projects.
    - **New**: **GlobalDecisionBoard** (The 4 buckets).
- **`ProjectListScreen`** (New Component):
    - **Role**: The old DashboardScreen functionality.
    - **Access**: Via header button "Projects".

### 4.2 Data Fetching
- **Global Board**:
    - Query: `db.doors.toArray()` (or filtered by status).
    - Join: Must fetch Project Name for each door to display the Context Tag.
