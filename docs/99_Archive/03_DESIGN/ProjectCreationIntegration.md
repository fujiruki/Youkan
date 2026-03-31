# Project Creation Integration Design (Sekkei)

## 1. Objective
To unify the "Create Project" experience across the Dashboard and Project Registry screens. The new dialog must support:
- **Context Awareness**: Knowing if it's being created under a specific parent project or company scope.
- **Hierarchy Selection**: Allowing the user to choose between creating a "Sub-project" (Child) or "Root/Sibling project".
- **Manufacturing Fields**: Supporting industry-specific fields like `clientName` and `grossProfitTarget`.

## 2. Architecture (MVVM)

### Model
- **Project Entity**: Existing `Project` interface.
- **CreationContext**: New interface to pass context.
  ```typescript
  interface ProjectCreationContext {
      parentProject?: Project | null; // Focused project (if any)
      activeScope?: 'personal' | 'company'; // Current view scope
      defaultTenantId?: string; // Current tenant context
  }
  ```

### ViewModel: `useProjectCreationViewModel`
A dedicated hook to manage the dialog state.
- **Inputs**: `context: ProjectCreationContext`
- **State**:
  - `creationMode`: `'child' | 'root'` (Default to 'child' if parent exists, else 'root')
  - `selectedTenantId`: Logic to lock this if `creationMode === 'child'`.
  - `form`: { name, clientName, grossProfitTarget, ... }
- **Logic**:
  - `resolveTenant()`: If Child, return Parent.tenantId. If Root, return selectedTenantId.

### View: `ProjectCreationDialog`
- **Props**:
  - `isOpen`: boolean
  - `context`: ProjectCreationContext
  - `onClose`: () => void
  - `onCreate`: (data: ProjectCreationData) => Promise<void>
- **UI**:
  - **Location Selector** (Radio Group): Shown only if `context.parentProject` is present.
    - Option A: "Create inside {ParentName}" (Sub-project)
    - Option B: "Create as independent project" (Root level)
  - **Company Selector**: Disabled if Option A is selected.
  - **Manufacturing Fields**: Shown based on tenant config.

## 3. Test Scenarios (TDD)

### Scenario 1: Dashboard (No Focus)
- **Given**: No project is focused.
- **When**: Dialog opens.
- **Then**:
  - "Location Selector" is HIDDEN.
  - "Company Selector" is ENABLED (default to current valid tenant).

### Scenario 2: Dashboard (Project A Focus, A belongs to Company X)
- **Given**: Project A is focused.
- **When**: Dialog opens.
- **Then**:
  - "Location Selector" is SHOWN.
  - Default selection: "Create inside Project A".
  - "Company Selector" is DISABLED and set to "Company X".

### Scenario 3: Dashboard (Project A Focus) -> User switches to Root
- **Given**: Project A is focused.
- **When**: User selects "Create as independent project".
- **Then**:
  - "Company Selector" becomes ENABLED.

### Scenario 4: Project Registry (Company Scope)
- **Given**: User is in Project Registry (Company Scope).
- **When**: Dialog opens.
- **Then**:
  - "Location Selector" is HIDDEN (unless we pass a selected row context later).
  - "Company Selector" is ENABLED but defaults to current scope context.

## 4. Implementation Steps
1.  **Refactor `ProjectCreationDialog`**:
    - Extract logic to `useProjectCreationViewModel`.
    - Add `creationMode` state and radio buttons.
    - Add `clientName`, `grossProfitTarget` fields.
2.  **Update Dashboard Usage**:
    - Pass `focusProject` into the dialog context.
3.  **Update ProjectRegistry Usage**:
    - Replace local `ProjectModal` with `ProjectCreationDialog`.
