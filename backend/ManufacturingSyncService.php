<?php
// backend/ManufacturingSyncService.php
require_once 'db.php';
require_once 'Constants.php';

class ManufacturingSyncService {
    
    /**
     * Called when a new item is created or updated in ItemController.
     */
    public static function syncItem($pdo, $itemId, $data) {
        if (!isset($data['category'])) return;

        $category = $data['category'];
        $fabMinutes = $data['fab_minutes'] ?? 0;
        $siteMinutes = $data['site_minutes'] ?? 0;
        $laborRate = $data['labor_rate'] ?? 0;
        $imageUrl = $data['image_url'] ?? null;
        $meta = isset($data['meta']) ? json_encode($data['meta']) : null;
        $now = time();

        // 1. Check if manufacturing entry exists
        $stmt = $pdo->prepare("SELECT id FROM manufacturing_items WHERE item_id = ?");
        $stmt->execute([$itemId]);
        $existing = $stmt->fetch();

        if ($existing) {
            // Update
            $sql = "UPDATE manufacturing_items SET 
                    category = ?, fab_minutes = ?, site_minutes = ?, 
                    labor_rate = ?, image_url = ?, meta = ?, updated_at = ?
                    WHERE item_id = ?";
            $pdo->prepare($sql)->execute([
                $category, $fabMinutes, $siteMinutes, 
                $laborRate, $imageUrl, $meta, $now, $itemId
            ]);
        } else {
            // Create
            $sql = "INSERT INTO manufacturing_items (
                    id, item_id, category, fab_minutes, site_minutes, 
                    labor_rate, image_url, meta, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
            $mfgId = 'mfg_' . uniqid();
            $pdo->prepare($sql)->execute([
                $mfgId, $itemId, $category, $fabMinutes, $siteMinutes,
                $laborRate, $imageUrl, $meta, $now, $now
            ]);

            // 2. Automation: If Fabrication, generate a production task
            if ($category === ManufacturingCategory::FABRICATION) {
                self::autoGenerateTask($pdo, $itemId, "製作: " . $data['title'], $fabMinutes, $data);
            }
        }
    }

    private static function autoGenerateTask($pdo, $parentId, $title, $minutes, $originalData) {
        $taskId = 'task_' . uniqid();
        $now = time();
        $tenantId = $originalData['tenant_id'] ?? null;
        $createdBy = $originalData['created_by'] ?? 'system';

        $sql = "INSERT INTO items (
                id, tenant_id, title, status, created_at, updated_at, status_updated_at,
                parent_id, estimated_minutes, created_by, due_date
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
        
        $pdo->prepare($sql)->execute([
            $taskId,
            $tenantId,
            $title,
            'inbox', // Default to inbox for review
            $now, $now, $now,
            $parentId,
            $minutes,
            $createdBy,
            $originalData['due_date'] ?? null
        ]);
        
        // Also promote parent to project if it wasn't
        $pdo->prepare("UPDATE items SET is_project = 1 WHERE id = ?")->execute([$parentId]);
    }
}
