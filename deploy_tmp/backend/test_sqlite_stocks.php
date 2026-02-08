<?php
// backend/test_sqlite_stocks.php
$dbPath = __DIR__ . '/test_stocks.sqlite';
if (file_exists($dbPath)) unlink($dbPath);

try {
    $pdo = new PDO('sqlite:' . $dbPath);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    
    echo "Creating stocks table...\n";
    $sql = "CREATE TABLE IF NOT EXISTS stocks (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            project_id TEXT,
            estimated_minutes INTEGER DEFAULT 0,
            due_date TEXT,
            status TEXT DEFAULT 'open',
            created_at INTEGER
        )";
    $pdo->exec($sql);
    echo "Stocks created.\n";

    echo "Creating projects table...\n";
    $sql = "CREATE TABLE IF NOT EXISTS projects (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            status TEXT DEFAULT 'active',
            progress_rate INTEGER DEFAULT 0,
            total_weight INTEGER DEFAULT 0,
            current_weight INTEGER DEFAULT 0,
            created_at INTEGER
        )";
    $pdo->exec($sql);
    echo "Projects created.\n";

} catch (PDOException $e) {
    echo "PDO Error: " . $e->getMessage() . "\n";
} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
echo "Done.\n";
