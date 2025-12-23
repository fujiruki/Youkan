# Restructuring and Feature Implementation Plan

## Overview
This document outlines the plan to restructure the `JWCADTategu` project directory to clearly separate the Web application from the original JWCAD Plugin (Windows Forms/Console), and to implement requested UI/UX enhancements.

## 1. Project Directory Restructuring

### Current State
Currently, the root directory contains a mix of the Web project (`JWCADTategu.Web`) and the .NET Plugin solution (`.sln`, `.UI`, `.Core`, etc.), causing confusion and clutter.

### Proposed Structure
We will create a new directory `JWCADPlugin` within the root and move all legacy/plugin-related files into it. The Web project will remain at the root level (or in `JWCADTategu.Web` as is).

**Goal Hierarchy:**
```
JWCADTategu/ (Root)
│
├── JWCADTategu.Web/         [KEEP] React/Vite Web Application
│
├── JWCADPlugin/             [NEW] Container for Plugin Project
│   ├── JWCADTategu.sln      [MOVE]
│   ├── JWCADTategu.UI/      [MOVE]
│   ├── JWCADTategu.Core/    [MOVE]
│   ├── JWCADTategu.Console/ [MOVE]
│   ├── JWCADTategu.Tests/   [MOVE]
│   ├── scripts/             [MOVE]
│   ├── Tategu.bat           [MOVE]
│   └── (Other plugin docs)  [MOVE]
│
├── .git/                    [KEEP]
├── .gitignore               [KEEP]
└── .agent/                  [KEEP]
```

### Execution Steps
1.  Create `JWCADPlugin` directory.
2.  Move the following directories/files to `JWCADPlugin`:
    *   `JWCADTategu.sln`
    *   `JWCADTategu.UI`
    *   `JWCADTategu.Core`
    *   `JWCADTategu.Console`
    *   `JWCADTategu.Tests`
    *   `scripts`
    *   `Tategu.bat`, `speed_test.bat`, `Tategu_utf8.txt`
    *   `*_spec.md` (if specific to plugin), `Hikitsugi.md`
3.  Update `.gitignore` if necessary (paths might shift, but mostly stays valid).
4.  User Verification: Ensure the .NET solution still builds (might need to re-open solution to adjust relative paths if any were absolute, but standard relative refs within SLN should work if all project folders moved together).

---

## 2. Feature Enhancements (Web)

### A. Editor: Editable Door Name
**Requirement**: Display the door name (e.g., "Door A") above the preview area in the Editor screen and allow inline editing.

**Implementation**:
*   **Component**: `src/components/Editor/EditorScreen.tsx`
*   **UI**: Add a text input above the `PreviewCanvas`.
*   **Logic**: Bind to `door.name`. On change, update the local door state.
*   **Persistence**: Ensure the name change saves to Dexie.js when the door is saved.

### B. Global Settings: Project Defaults
**Requirement**: Allow setting default "Unit Price (M3)" and "Fill Color" for the project.

**Implementation**:
*   **Database**: The `Project` schema already allows `settings`.
*   **UI Location**: Add a "Settings" button/modal to the `DashboardScreen` or a "Project Settings" panel in `EditorScreen`.
*   **Features**:
    *   **Default Unit Price**: Used when creating new materials/estimations.
    *   **Default Fill Color**: Used for the graphical preview.
*   **Logic**: Update `Project` record in `ProjectRepository`.

---

## 3. Next Steps
Upon approval of this plan, the folder restructuring will be performed first, followed by the feature implementation.
