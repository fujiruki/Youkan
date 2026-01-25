---
description: Run automated system tests for valid basic features (Auth, Board, Today, Calendar)
---

# Use this workflow to verify the basic functions of JBWOS.

## 1. Environment Check
Check if the server is running.
// turbo
1. Check if backend is responding: `Test-NetConnection -ComputerName localhost -Port 8000`
// turbo
2. Check if frontend is hosted: `Test-NetConnection -ComputerName localhost -Port 5173`

## 2. Browser Verification (E2E)
Launch the browser subagent to verify valid user journeys.

3. Run browser verification task:
```
task: "Verify the following user journeys:
1. Login:
   - Go to http://localhost:5173/login
   - Login with email: 'debug@example.com', password: 'password'
   - Expect redirect to Dashboard (/)
2. Board Interaction:
   - Check if 'Settings' link exists in header.
   - Navigate to 'http://localhost:5173/jbwos' (Board).
   - Verify drag and drop columns exist (Plan/Stock).
3. Volume Calendar:
   - Navigate to 'http://localhost:5173/calendar'.
   - Verify content loads (Heatmap).
4. Logout:
   - Click Logout in header.
   - Verify redirect to Login.
Return 'Success' only if all steps pass."
```

## 3. Unit Tests (Logic)
Run internal logic tests to ensure calculations are correct.

// turbo
4. Run Allocation Calculator Tests: `npm.cmd test src/features/core/calendar/logic/AllocationCalculator.test.ts`
