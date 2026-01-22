<?php
// backend/migrate_v7_cloud_tables.php
require_once 'db.php';

try {
    $pdo = getDB();
    echo "Starting migration v7 (Cloud & Multi-tenant Architecture)...\n";

    // --- 1. Identity & Access Management ---

    // 1.1 Users (Global)
    $pdo->exec("CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        display_name TEXT,
        created_at INTEGER
    )");
    echo "Created users table.\n";

    // 1.2 Tenants (Organizations)
    $pdo->exec("CREATE TABLE IF NOT EXISTS tenants (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        domain TEXT,
        created_at INTEGER
    )");
    echo "Created tenants table.\n";

    // 1.3 Memberships (M:N)
    $pdo->exec("CREATE TABLE IF NOT EXISTS memberships (
        user_id TEXT,
        tenant_id TEXT,
        role TEXT DEFAULT 'member', -- owner, admin, member
        PRIMARY KEY (user_id, tenant_id),
        FOREIGN KEY(user_id) REFERENCES users(id),
        FOREIGN KEY(tenant_id) REFERENCES tenants(id)
    )");
    echo "Created memberships table.\n";

    // 1.4 API Tokens (For Integrations / iPhone)
    $pdo->exec("CREATE TABLE IF NOT EXISTS api_tokens (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        token TEXT UNIQUE NOT NULL, -- sk_...
        label TEXT,
        created_at INTEGER,
        last_used_at INTEGER,
        FOREIGN KEY(user_id) REFERENCES users(id)
    )");
    echo "Created api_tokens table.\n";

    // --- 2. Business Data (Tenant Scoped) ---

    // 2.0 Drop Prototype Projects if exists (from v6)
    // NOTE: We are replacing the simple 'projects' table with the robust one.
    // If v6 data exists, it might be lost, but v6 was prototype-only.
    // Let's renaming it to 'projects_trash_v6' just in case.
    $pdo->exec("ALTER TABLE projects RENAME TO projects_v6_backup"); 
    echo "Backed up existing projects table to projects_v6_backup (if existed).\n";
    // Ignore error if not exists

    // 2.1 Projects (Manufacturing Context)
    $pdo->exec("CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        name TEXT NOT NULL,
        client TEXT,
        settings_json TEXT,         -- EstimationSettings
        dxf_config_json TEXT,       -- DxfLayerConfig
        view_mode TEXT DEFAULT 'internal',
        judgment_status TEXT DEFAULT 'inbox',
        is_archived INTEGER DEFAULT 0,
        
        created_at INTEGER,
        updated_at INTEGER,
        FOREIGN KEY(tenant_id) REFERENCES tenants(id)
    )");
    echo "Created projects table (New Scoped).\n";

    // 2.2 Doors
    // Note: We are migrating from local generic object store to strict Schema.
    $pdo->exec("CREATE TABLE IF NOT EXISTS doors (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        project_id TEXT,
        deliverable_id TEXT,
        tag TEXT,
        name TEXT,
        
        dimensions_json TEXT,
        specs_json TEXT,
        count INTEGER DEFAULT 1,
        thumbnail_url TEXT,
        
        status TEXT, -- design, production
        man_hours REAL,
        complexity REAL,
        start_date TEXT, -- YYYY-MM-DD
        due_date TEXT,
        
        category TEXT,
        generic_specs_json TEXT,

        judgment_status TEXT,
        waiting_reason TEXT,
        weight INTEGER,
        rough_timing TEXT,
        
        created_at INTEGER,
        updated_at INTEGER,
        FOREIGN KEY(tenant_id) REFERENCES tenants(id),
        FOREIGN KEY(project_id) REFERENCES projects(id)
    )");
    echo "Created doors table.\n";

    // 2.3 Deliverables
    $pdo->exec("CREATE TABLE IF NOT EXISTS deliverables (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        project_id TEXT, -- JBWOS Item ID (Parent)
        linked_item_id TEXT,
        name TEXT,
        type TEXT,
        status TEXT,
        
        estimated_work_minutes INTEGER,
        estimated_site_minutes INTEGER,
        actual_work_minutes INTEGER,
        actual_site_minutes INTEGER,
        cost_json TEXT,
        
        requires_site_installation INTEGER,
        description TEXT,
        note TEXT,
        
        created_at INTEGER,
        updated_at INTEGER,
        FOREIGN KEY(tenant_id) REFERENCES tenants(id)
    )");
    echo "Created deliverables table.\n";

    // --- 3. Default Seed Data (Auto-Setup) ---
    // Check if any tenant exists
    $stmt = $pdo->query("SELECT count(*) FROM tenants");
    if ($stmt->fetchColumn() == 0) {
        $tenantId = 't-' . uniqid();
        $userId = 'u-' . uniqid();
        $token = 'sk_live_' . bin2hex(random_bytes(16));
        $now = time();

        // Create Default Tenant
        $pdo->prepare("INSERT INTO tenants (id, name, created_at) VALUES (?, ?, ?)")
            ->execute([$tenantId, 'Tategu Design Studio', $now]);
        
        // Create Default Admin User (Password: admin123)
        $pwHash = password_hash('admin123', PASSWORD_DEFAULT);
        $pdo->prepare("INSERT INTO users (id, email, password_hash, display_name, created_at) VALUES (?, ?, ?, ?, ?)")
            ->execute([$userId, 'admin@door-fujita.com', $pwHash, 'Admin User', $now]);

        // Membership
        $pdo->prepare("INSERT INTO memberships (user_id, tenant_id, role) VALUES (?, ?, ?)")
            ->execute([$userId, $tenantId, 'owner']);

        // API Token
        $pdo->prepare("INSERT INTO api_tokens (id, user_id, token, label, created_at) VALUES (?, ?, ?, ?, ?)")
            ->execute(['atk-' . uniqid(), $userId, $token, 'Default iPhone', $now]);

        echo "\n[SEED] Created Default Tenant & User.\n";
        echo "User: admin@door-fujita.com / admin123\n";
        echo "Tenant ID: $tenantId\n";
        echo "API Token: $token\n";
    }

    echo "Migration v7 completed successfully.\n";

} catch (Exception $e) {
    // If ALTER TABLE fails (e.g. table doesn't exist), it's fine, continue?
    // Actually PDO throws exception.
    if (strpos($e->getMessage(), 'no such table') !== false) {
       echo "Note: " . $e->getMessage() . " (Ignored)\n";
    } else {
        echo "Error: " . $e->getMessage() . "\n";
        exit(1);
    }
}
