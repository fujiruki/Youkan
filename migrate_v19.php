<?php
// migrate_v19.php
// Proxy to run the migration script from the root

ini_set('display_errors', 1);
error_reporting(E_ALL);

echo "Starting migration via root proxy...\n";

// Change directory to backend so require_once works correctly
chdir(__DIR__ . '/backend');

require_once 'migrate_v19_jbwos_core.php';
