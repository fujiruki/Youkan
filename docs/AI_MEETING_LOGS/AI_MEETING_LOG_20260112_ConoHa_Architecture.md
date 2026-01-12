# AI Meeting Log: ConoHa WING Architecture Strategy

## 0. Meta Info
- **Date**: 2026-01-12
- **Trigger**: User request ("本番サーバーはconohaのwing...そのうえで会議をおねがいします")
- **Theme**: Defining the JBWOS Architecture for ConoHa WING Deployment
- **Goal**: Decide on the stack (Frontend/Backend/DB) and Debugging Strategy.
- **Prerequisites**:
    -   Must run on ConoHa WING (PHP environment).
    -   Must support "AI Autonomous Debugging" (overcoming PHP opacity).
    -   Future goal: Sync with local browser.

## 1. Casting
- **Facilitator**: Antigravity
- **Tech Lead (Implementation)**: Focus on PHP, SQLite/MySQL, Deployment.
- **Business (Continuity)**: Focus on maintenance cost and stability.
- **UX (User)**: Focus on speed and "Offline-First" feel.
- **Risk (Legal/Security)**: Focus on data leaks and shared hosting risks.

## 2. Discussion Rounds

### Round 1: Initial Proposals (Divergence)

**Tech Lead**:
Proposes **"Static React + Slim PHP API + SQLite"**.
- **Reasoning**: Automatic deployment is easy via FTP/Git. SQLite requires no dashboard setup. PHP is native to ConoHa.
- **Debug Strategy**: Build a `POST /api/__debug_log` endpoint where the frontend sends its console logs, and a `GET /api/__server_log` where AI can read `error_log` contents.

**Business**:
Agrees with **SQLite** for now.
- **Reasoning**: Validating the "Product-Market Fit" quickly is key. MySQL adds setup friction. If traffic grows, migration to MySQL is standard.
- **Concern**: Backup strategy? SQLite is just a file, so we can just download it.

**UX**:
Insists on **"Local-First" architecture**.
- **Reasoning**: The user mentioned "Local browser + Server sync". The app should work primarily in the browser (IndexedDB) for speed, and sync to the server in the background.
- **Benefit**: No loading spinners. Works offline.

**Risk**:
Warns about **SQLite file permission**.
- **Reasoning**: If `.sqlite` is in the public folder, anyone can download it.
- **Mitigation**: Put the DB file *outside* the `public_html` or block access via `.htaccess`.

### Round 2: Cross Review (Debate)

**Tech Lead -> UX**:
"Local-First" is great but implementing reliable **Sync Logic** (CRDT or delta sync) is 10x harder than a simple CRUD API.
- **Refutation**: For the MVP (Minimum Viable Product), we should start with **Server-Side Master**. The browser just fetches data. Sync can come later (Phase 2).

**Risk -> Tech Lead**:
Regarding the "Debug Endpoint" (`GET /api/__server_log`).
- **Danger**: If exposed, attackers can read system logs.
- **Requirement**: Must be protected by a hard-coded "AI_SECRET_KEY" or IP restriction.

**Business -> Tech Lead**:
Can AI really debug PHP?
- **Answer**: If we pipe `set_error_handler` to a JSON output buffer when a specific header is present, AI can read PHP errors as structured JSON. It's viable.

### Round 3: Integration (Convergence)

**Facilitator**:
Let's synthesize.
1.  **Stack**: React (SPA) + PHP 8.x (API) + SQLite.
2.  **DB Security**: SQLite file must be protected (`.htaccess` or outside root).
3.  **Sync**: Start with "Online-Only" (Server Master) for simplicity. Sync needed later? -> User said "Later". So MVP is Server Master.
4.  **Debug**: Implement a "Secret Debug API" that returns logs/errors in JSON.

## 3. Final Conclusion

### Conclusion: **Adoption of "React + PHP + SQLite" Stack**

### Adoption Reasons
1.  **ConoHa Compatibility**: Runs natively without special configuration.
2.  **AI Maintainability**: SQLite reduces environment setup errors. PHP is stable.
3.  **Debuggability**: Solved by implementing a custom "AI-Readable Error Handler" and Log API.

### Discarded Options
- **Node.js on ConoHa**: Unstable process management on shared hosting.
- **Local-First Sync (Initial)**: Too complex for now. Postponed to "Phase 2".

### Expected Risks & Mitigations
- **Risk**: SQLite file exposure.
- **Mitigation**: Create a secure directory `.db_secure/` protected by `.htaccess` deny all.
- **Risk**: PHP Syntax Errors causing blank pages (White Screen of Death).
- **Mitigation**: Verify PHP syntax locally (`php -l`) before deploy, or use a "Safe Deploy" script.

### Next Actions
1.  **Create Architecture Spec**: Document the folder structure and API endpoints.
2.  **Dev Environment**: Set up a local PHP server (built-in `php -S`) to mimic ConoHa.
3.  **Implement Debug API**: Prioritize the "AI Eyes" (log viewer) before business logic.
