<?php
// backend/migrate_v18_status_reborn.php
// Phase 13: JBWOS Reborn - Status Model Migration
// Goal: Enforce new status model (Inbox, Focus, Pending, Waiting, Done)

require_once __DIR__ . '/db.php';

try {
    $pdo = getDB();
    echo "Starting Status Model Migration (v18)...\n";

    $pdo->beginTransaction();

    // 1. Migrate 'ready' to 'focus'
    $stmt = $pdo->query("SELECT count(*) FROM items WHERE status = 'ready'");
    $countReady = $stmt->fetchColumn();
    if ($countReady > 0) {
        $pdo->exec("UPDATE items SET status = 'focus' WHERE status = 'ready'");
        echo "Migrated $countReady items from 'ready' to 'focus'.\n";
    } else {
        echo "No 'ready' items found.\n";
    }

    // 2. Migrate 'standby' to 'inbox' (or 'pending'?)
    // Plan says "standby -> inbox/pending". Let's default to 'inbox' for safety, user can triage.
    $stmt = $pdo->query("SELECT count(*) FROM items WHERE status = 'standby'");
    $countStandby = $stmt->fetchColumn();
    if ($countStandby > 0) {
        $pdo->exec("UPDATE items SET status = 'inbox' WHERE status = 'standby'");
        echo "Migrated $countStandby items from 'standby' to 'inbox'.\n";
    } else {
        echo "No 'standby' items found.\n";
    }

    // 3. Migrate 'is_today_commit' -> 'focus' (Legacy Today Screen)
    // Check if column exists
    $columns = $pdo->query("PRAGMA table_info(items)")->fetchAll(PDO::FETCH_COLUMN, 1);
    if (in_array('is_today_commit', $columns)) {
        $stmt = $pdo->query("SELECT count(*) FROM items WHERE is_today_commit = 1 AND status != 'done'");
        $countToday = $stmt->fetchColumn();
        if ($countToday > 0) {
            // Only update if not already focus (though ready->focus handled above)
            $pdo->exec("UPDATE items SET status = 'focus' WHERE is_today_commit = 1 AND status != 'done' AND status != 'focus'");
            echo "Migrated $countToday items from 'Today Flag' to 'focus'.\n";
        } else {
            echo "No active 'Today' flagged items found.\n";
        }
    } else {
        echo "Column 'is_today_commit' does not exist. Skipping.\n";
    }

    $pdo->commit();
    echo "Migration v18 Complete.\n";

} catch (PDOException $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    echo "Migration Failed: " . $e->getMessage() . "\n";
    exit(1);
}
