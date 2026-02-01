<?php
try {
    $db = new PDO('sqlite:backend/jbwos.sqlite');
    $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    echo "--- Tables ---\n";
    $tables = $db->query("SELECT name FROM sqlite_master WHERE type='table'")->fetchAll(PDO::FETCH_COLUMN);
    echo "Count: " . count($tables) . "\n";
    print_r($tables);

    
    $user = null;
    $userTableName = in_array('users', $tables) ? 'users' : (in_array('user', $tables) ? 'user' : null);

    if ($userTableName) {
        echo "\n--- User Info ($userTableName) ---\n";
        $stmt = $db->prepare("SELECT id, email, display_name FROM $userTableName WHERE email = ?");
        $stmt->execute(['debug@example.com']);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);
        print_r($user);
    } else {
        echo "No 'users' or 'user' table found.\n";
    }

    if ($user) {
        $membershipTable = null;
        if (in_array('memberships', $tables)) $membershipTable = 'memberships';
        elseif (in_array('company_members', $tables)) $membershipTable = 'company_members';
        elseif (in_array('organization_members', $tables)) $membershipTable = 'organization_members';
        
        if ($membershipTable) {
            echo "\n--- Memberships ($membershipTable) ---\n";
            $stmt = $db->prepare("SELECT * FROM $membershipTable WHERE user_id = ?");
            $stmt->execute([$user['id']]);
            $memberships = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            if (empty($memberships)) {
                echo "NO MEMBERSHIPS FOUND for User ID: {$user['id']}\n";
            } else {
                print_r($memberships);
            }

            if (!empty($memberships)) {
                echo "\n--- Related Organizations ---\n";
                foreach ($memberships as $m) {
                    $orgId = $m['organization_id'] ?? $m['tenant_id'] ?? null;
                    if ($orgId) {
                        // Try tenants or organizations table
                        if (in_array('tenants', $tables)) {
                            $stmt = $db->prepare('SELECT * FROM tenants WHERE id = ?');
                            $stmt->execute([$orgId]);
                            $t = $stmt->fetch(PDO::FETCH_ASSOC);
                            echo "Tenant: "; print_r($t);
                        }
                        if (in_array('organizations', $tables)) {
                            $stmt = $db->prepare('SELECT * FROM organizations WHERE id = ?');
                            $stmt->execute([$orgId]);
                            $o = $stmt->fetch(PDO::FETCH_ASSOC);
                            echo "Organization: "; print_r($o);
                        }
                    }
                }
            }
        }
    }

} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
