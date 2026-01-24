<?php
try {
    $pdo = new PDO('sqlite:backend/jbwos.sqlite');
    $stmt = $pdo->query("PRAGMA table_info(items)");
    $columns = $stmt->fetchAll(PDO::FETCH_ASSOC);
    foreach ($columns as $col) {
        if ($col['name'] === 'tenant_id') {
            echo "Column: tenant_id\n";
            echo "NotNull: " . $col['notnull'] . "\n"; // 1 = Not Null, 0 = Nullable
            echo "Default: " . $col['dflt_value'] . "\n";
        }
    }
} catch (Exception $e) {
    echo "Error: " . $e->getMessage();
}
