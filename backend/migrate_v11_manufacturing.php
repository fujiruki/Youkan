<?php
// backend/migrate_v11_manufacturing.php
require_once 'db.php';

try {
    $pdo = getDB();
    echo "Starting migration v11 (Manufacturing Core Schema)...\n";

    // 1. Documents (Estimates, Sales, Invoices)
    $pdo->exec("CREATE TABLE IF NOT EXISTS documents (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        project_id TEXT,
        type TEXT NOT NULL, -- 'estimate', 'sales', 'invoice'
        status TEXT DEFAULT 'draft',
        issue_date TEXT,
        total_amount INTEGER DEFAULT 0, -- Tax included
        tax_rate REAL DEFAULT 0.1,
        cost_total INTEGER DEFAULT 0,
        profit_rate REAL DEFAULT 0,
        snapshot_json TEXT, -- Client info, company info at that time
        created_by TEXT,
        created_at INTEGER,
        updated_at INTEGER,
        FOREIGN KEY(tenant_id) REFERENCES tenants(id),
        FOREIGN KEY(project_id) REFERENCES projects(id)
    )");
    echo "Created/Verified documents table.\n";

    // 2. Document Items (Details)
    $pdo->exec("CREATE TABLE IF NOT EXISTS document_items (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        document_id TEXT NOT NULL,
        name TEXT NOT NULL,
        quantity REAL DEFAULT 1,
        unit_price INTEGER DEFAULT 0,
        cost_detail_json TEXT, -- {materials:[], labor:.., markup:..}
        position INTEGER DEFAULT 0,
        FOREIGN KEY(tenant_id) REFERENCES tenants(id),
        FOREIGN KEY(document_id) REFERENCES documents(id)
    )");
    echo "Created/Verified document_items table.\n";

    // 3. Master Items (Materials, Hardware)
    $pdo->exec("CREATE TABLE IF NOT EXISTS master_items (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        category TEXT, -- 'material', 'hardware', 'labor', etc.
        name TEXT NOT NULL,
        unit_price INTEGER DEFAULT 0,
        supplier TEXT,
        image_url TEXT,
        specs_json TEXT, -- dimensions, color, etc.
        created_at INTEGER,
        updated_at INTEGER,
        FOREIGN KEY(tenant_id) REFERENCES tenants(id)
    )");
    echo "Created/Verified master_items table.\n";

    echo "Migration v11 completed successfully.\n";

} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
    exit(1);
}
