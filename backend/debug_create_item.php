<?php
// backend/debug_create_item.php
require_once 'db.php';

try {
    $pdo = getDB();
    echo "Attempting to insert dummy item...\n";

    $id = uniqid('debug_', false);
    $now = time();
    $tenantId = null; // [Test] Null Tenant
    $userId = 'u_default';
    
    // ItemController.php:346 のSQLを模倣
    $sql = "
        INSERT INTO items (
            id, tenant_id, title, status, created_at, updated_at, status_updated_at,
            parent_id, is_project, project_category, estimated_minutes, assigned_to, delegation,
            project_id, created_by, project_type
        ) VALUES (
            ?, ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?, ?,
            ?, ?, ?
        )
    ";

    $stmt = $pdo->prepare($sql);
    
    $params = [
        $id,
        $tenantId,      // tenant_id
        'Debug Item ' . $now, // title
        'inbox',        // status
        $now, $now, $now, // dates
        null,           // parent_id
        0,              // is_project
        null,           // project_category
        0,              // estimated_minutes
        null,           // assigned_to
        null,           // delegation
        null,           // project_id
        $userId,        // created_by
        'generic'       // project_type
    ];

    $stmt->execute($params);
    echo "Success! Item inserted with ID: $id\n";
    
    // Clean up
    $pdo->exec("DELETE FROM items WHERE id = '$id'");
    echo "Cleaned up debug item.\n";

} catch (PDOException $e) {
    echo "PDO Error: " . $e->getMessage() . "\n";
    echo "Code: " . $e->getCode() . "\n";
} catch (Exception $e) {
    echo "General Error: " . $e->getMessage() . "\n";
}
