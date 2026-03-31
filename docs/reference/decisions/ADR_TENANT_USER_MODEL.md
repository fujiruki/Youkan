# ADR: Data Ownership Model - Personal First, Tenant Optional

## Status
Accepted

## Date
2026-01-26

## Context
Initial system design assumed a "B2B SaaS" model where a User MUST belong to a Tenant (Company) to have any data.
- **Old Assumption**: User -> Membership -> Tenant -> Data
- **Problem**: This forced "Personal Use" to require a "Personal Tenant", creating unnecessary complexity (ghost tenants, self-healing logic errors) and conceptual mismatch with the user's vision.

## Decision
We adopt a **"Personal First, Tenant Optional"** model.

1.  **User Sovereignty**: Users exist independently of any organization.
2.  **Data Ownership**:
    - **Personal Data**: Items where `tenant_id` is `NULL`. Owned solely by the User.
    - **Tenant Data**: Items where `tenant_id` is set. Owned by the Tenant, access controlled by Membership.
3.  **Use Case**:
    - A freelancer can use JBWOS purely for personal task management (Personal Data).
    - Later, they can join a Company (Tenant) and access Company Data.
    - They can be a member of multiple Companies while maintaining their Personal Data.

## Consequences

### Backend (PHP)
- `BaseController` must NOT enforce tenant creation upon login. `currentTenantId` can be null.
- `ItemController` and `TodayController` queries must explicitly handle the dual mode:
  - If Context has Tenant ID -> Query `WHERE tenant_id = ?`
  - If Context is Personal -> Query `WHERE tenant_id IS NULL AND created_by = ?`

### Verification Strategy
- **TDD**: Test cases must cover:
  1.  User with NO Tenant creating an item (Personal Item).
  2.  User with Tenant creating an item (Tenant Item).
  3.  User with Tenant trying to see Personal Item (Should likely be separate views or mixed depending on UI design - *Current Decision: Context Switch*).

### UI (Frontend)
- The UI should clearly indicate the current context (Personal vs Company A vs Company B).
- "Personal Mode" is a valid state, not an error state.
