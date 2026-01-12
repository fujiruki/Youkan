<?php
echo "--------------------------------------------------\n";
echo "PHP DIAGNOSTIC REPORT\n";
echo "--------------------------------------------------\n";
echo "PHP Version: " . phpversion() . "\n";
echo "Loaded Configuration File: " . php_ini_loaded_file() . "\n";
echo "extension_dir: " . ini_get('extension_dir') . "\n";
echo "--------------------------------------------------\n";
echo "Checking Extensions...\n";
echo "pdo_sqlite: " . (extension_loaded('pdo_sqlite') ? "✅ LOADED" : "❌ MISSING") . "\n";
echo "sqlite3:    " . (extension_loaded('sqlite3') ? "✅ LOADED" : "❌ MISSING") . "\n";
echo "mbstring:   " . (extension_loaded('mbstring') ? "✅ LOADED" : "❌ MISSING") . "\n";
echo "--------------------------------------------------\n";

if (!extension_loaded('pdo_sqlite')) {
    echo "Is C:\\php\\ext\\php_pdo_sqlite.dll present?\n";
    if (file_exists('C:\\php\\ext\\php_pdo_sqlite.dll')) {
        echo "YES, file exists at default path.\n";
    } else {
        echo "CANNOT CHECK (File system access restricted or custom path)\n";
    }
}
