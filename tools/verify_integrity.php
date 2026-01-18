<?php
/**
 * Verification Script for Tategu Design Studio
 * 
 * Usage: php tools/verify_integrity.php
 * 
 * Checks:
 * 1. PHP Syntax Check (Lint) for all .php files
 * 2. Directory Structure Integrity
 */

echo "🔍 Starting Integrity Verification...\n";

// 1. PHP Syntax Check
echo "\n[1/2] PHP Syntax Check...\n";
$files = new RecursiveIteratorIterator(
    new RecursiveDirectoryIterator(__DIR__ . '/../backend')
);

$exclude = ['.', '..'];
$errorCount = 0;

foreach ($files as $file) {
    if ($file->getExtension() === 'php') {
        $path = $file->getPathname();
        // Skip logs or cache if any
        
        $output = [];
        $returnVar = 0;
        exec("php -l \"$path\"", $output, $returnVar);
        
        if ($returnVar !== 0) {
            echo "❌ Syntax Error: $path\n";
            foreach ($output as $line) {
                echo "   $line\n";
            }
            $errorCount++;
        } else {
            // Echo strict success only verbose
            // echo "✅ OK: " . basename($path) . "\n";
        }
    }
}

if ($errorCount === 0) {
    echo "✅ PHP Syntax Check Passed (All files OK).\n";
} else {
    echo "❌ PHP Syntax Check Failed: $errorCount files have errors.\n";
    exit(1);
}

// 2. Critical Files Check
echo "\n[2/2] Critical Files Check...\n";
$requiredFiles = [
    'backend/index.php',
    'backend/db.php',
    'backend/ItemController.php',
    'backend/api/customers.php', // Ensure newly added files exist
    'backend/StockController.php'
];

$missingCount = 0;
foreach ($requiredFiles as $file) {
    $path = __DIR__ . '/../' . $file;
    if (!file_exists($path)) {
        echo "❌ Missing: $file\n";
        $missingCount++;
    }
}

if ($missingCount === 0) {
    echo "✅ Critical Files Check Passed.\n";
} else {
    echo "❌ Critical Files Check Failed.\n";
    exit(1);
}

echo "\n✨ Verification Completed Successfully!\n";
exit(0);
