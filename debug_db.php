<?php
require_once 'backend/db.php';
try {
    $pdo = getDB();
    echo "Connected to DB.\n";
    $stm = $pdo->query("SELECT name FROM sqlite_master WHERE type='table'");
    $tables = $stm->fetchAll(PDO::FETCH_ASSOC);
    echo "Tables:\n";
    print_r($tables);

    require_once 'backend/LifeController.php';
    $lc = new LifeController($pdo);
    echo "History Count: " . count($lc->getHistory()) . "\n";
    
    $json = json_encode($lc->getHistory());
    if ($json === false) {
        echo "JSON Encode Error: " . json_last_error_msg() . "\n";
    } else {
        echo "JSON Encode Success. Length: " . strlen($json) . "\n";
        echo "Sample: " . substr($json, 0, 100) . "...\n";
    }

} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
