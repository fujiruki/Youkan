<?php
// backend/migrate_v12_company_settings.php
require_once 'db.php';

try {
    $pdo = getDB();
    echo "Starting migration v12 (Company Settings Schema)...\n";

    // Helper function to check if column exists
    function columnExists($pdo, $table, $column) {
        $stmt = $pdo->prepare("PRAGMA table_info($table)");
        $stmt->execute();
        $columns = $stmt->fetchAll(PDO::FETCH_ASSOC);
        foreach ($columns as $col) {
            if ($col['name'] === $column) {
                return true;
            }
        }
        return false;
    }

    $table = 'tenants';
    $columnsToAdd = [
        'address_zip' => 'TEXT',
        'address_main' => 'TEXT',
        'phone' => 'TEXT',
        'invoice_no' => 'TEXT',
        'bank_info' => 'TEXT', // JSON
        'closing_date' => 'INTEGER',
        'config' => 'TEXT' // JSON (Plugins, etc)
    ];

    foreach ($columnsToAdd as $col => $type) {
        if (!columnExists($pdo, $table, $col)) {
            echo "Adding column '$col' to '$table'...\n";
            $pdo->exec("ALTER TABLE $table ADD COLUMN $col $type");
        } else {
            echo "Column '$col' already exists in '$table'. Skipping.\n";
        }
    }

    echo "Migration v12 completed successfully.\n";

} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
    exit(1);
}
