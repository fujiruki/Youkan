<?php
// test_debug_controller.php (Updated)
try {
    require_once 'backend/db.php';
    echo "db.php included.\n";

    $db = getDB();
    echo "getDB() successful.\n";

    require_once 'backend/DebugController.php';
    echo "DebugController included.\n";
    
    $controller = new DebugController();
    echo "DebugController instantiated.\n";

    // Try calling handleRequest logic manually
    // Use Reflection to call private method? No, listUsers is private.
    // handleRequest calls listUsers.
    
    // Mock $_SERVER if needed? handleRequest uses $path and $method args.
    $controller->handleRequest('GET', '/users');
    echo "\n\nhandleRequest finished.\n";
    
} catch (Throwable $e) {
    echo "Error: " . $e->getMessage() . "\n";
    echo "File: " . $e->getFile() . "\n";
    echo "Line: " . $e->getLine() . "\n";
}
