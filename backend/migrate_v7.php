<?php
// backend/migrate_v7.php
require_once 'db.php';

try {
    $db = getDB();
    $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    echo "Starting Migration v7 (Items Table Extension)...\n";

    // 1. Add tenant_id if missing
    try {
        $db->query("SELECT tenant_id FROM items LIMIT 1");
        echo " - tenant_id already exists.\n";
    } catch (Exception $e) {
        $db->exec("ALTER TABLE items ADD COLUMN tenant_id TEXT DEFAULT NULL");
        echo " - Added tenant_id column.\n";
    }

    // 2. Add project_type if missing
    try {
        $db->query("SELECT project_type FROM items LIMIT 1");
        echo " - project_type already exists.\n";
    } catch (Exception $e) {
        $db->exec("ALTER TABLE items ADD COLUMN project_type TEXT DEFAULT NULL");
        echo " - Added project_type column.\n";
    }

    // 3. Add client if missing
    try {
        $db->query("SELECT client FROM items LIMIT 1");
        echo " - client already exists.\n";
    } catch (Exception $e) {
        $db->exec("ALTER TABLE items ADD COLUMN client TEXT DEFAULT NULL");
        echo " - Added client column.\n";
    }

    // 4. Add assigned_to if missing
    try {
        $db->query("SELECT assigned_to FROM items LIMIT 1");
        echo " - assigned_to already exists.\n";
    } catch (Exception $e) {
        $db->exec("ALTER TABLE items ADD COLUMN assigned_to TEXT DEFAULT NULL");
        echo " - Added assigned_to column.\n";
    }

    // 5. Add meta if missing
    try {
        $db->query("SELECT meta FROM items LIMIT 1");
        echo " - meta already exists.\n";
    } catch (Exception $e) {
        $db->exec("ALTER TABLE items ADD COLUMN meta TEXT DEFAULT NULL");
        echo " - Added meta column.\n";
    }
    
    // 6. Add is_core, daily_capacity_minutes to memberships if missing (Just in case)
    try {
         $db->query("SELECT is_core FROM memberships LIMIT 1");
         echo " - is_core already exists.\n";
    } catch (Exception $e) {
         // Create memberships table if not exists? Assuming it exists.
         // Alter table logic specific to SQLite (Cannot add multiple columns easily or constraints)
         try {
             $db->exec("ALTER TABLE memberships ADD COLUMN is_core INTEGER DEFAULT 0");
             echo " - Added is_core column.\n";
         } catch (Exception $e2) { echo "Failed to add is_core: " . $e2->getMessage() . "\n"; }
         
         try {
             $db->exec("ALTER TABLE memberships ADD COLUMN daily_capacity_minutes INTEGER DEFAULT 480");
             echo " - Added daily_capacity_minutes column.\n";
         } catch (Exception $e2) { echo "Failed to add daily_capacity_minutes: " . $e2->getMessage() . "\n"; }
    }

    echo "Migration Complete.\n";

} catch (PDOException $e) {
    echo "DB Connection Failed: " . $e->getMessage();
}
