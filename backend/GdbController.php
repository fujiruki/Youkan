<?php
// backend/GdbController.php

require_once 'BaseController.php';

class GdbController extends BaseController {

    public function __construct() {
        parent::__construct();
    }

    /**
     * Get GDB Shelf View.
     */
    public function getShelf() {
        $this->authenticate();
        $now = time();
        $tenantId = $this->currentTenantId;
        
        // 1. Active Section (Judgment Candidates)
        $sqlActive = "
            SELECT items.*, parent.title as parent_title
            FROM items 
            LEFT JOIN items parent ON items.parent_id = parent.id
            WHERE 
                items.tenant_id = ? AND
                items.status NOT IN ('confirmed', 'today_commit', 'execution_in_progress', 'execution_paused', 'done', 'decision_rejected', 'archive')
                AND (
                    items.status = 'inbox' 
                    OR (items.rdd_date IS NOT NULL AND items.rdd_date <= ?)
                )
            ORDER BY items.rdd_date ASC, items.created_at DESC
        ";
        
        $stmtActive = $this->pdo->prepare($sqlActive);
        $stmtActive->execute([$tenantId, $now]);
        $activeItems = array_map([$this, 'mapRow'], $stmtActive->fetchAll(PDO::FETCH_ASSOC));

        // 2. Preparation Section (Formerly Hold)
        $sqlPrep = "
            SELECT items.*, parent.title as parent_title
            FROM items 
            LEFT JOIN items parent ON items.parent_id = parent.id
            WHERE 
                items.tenant_id = ? AND
                items.status = 'decision_hold'
                AND (items.rdd_date IS NULL OR items.rdd_date > ?)
            ORDER BY items.prep_date ASC, items.updated_at DESC
        ";
        
        $stmtPrep = $this->pdo->prepare($sqlPrep);
        $stmtPrep->execute([$tenantId, $now]);
        $prepItems = array_map([$this, 'mapRow'], $stmtPrep->fetchAll(PDO::FETCH_ASSOC));

        // 3. Intent Section (Nice to do)
        $sqlIntent = "
            SELECT items.*, parent.title as parent_title
            FROM items 
            LEFT JOIN items parent ON items.parent_id = parent.id
            WHERE 
                items.tenant_id = ? AND
                items.status = 'intent' 
            ORDER BY items.updated_at DESC
        ";
        $stmtIntent = $this->pdo->prepare($sqlIntent);
        $stmtIntent->execute([$tenantId]);
        $intentItems = array_map([$this, 'mapRow'], $stmtIntent->fetchAll(PDO::FETCH_ASSOC));

        // 4. History Section (Log)
        $sqlLog = "
            SELECT items.*, parent.title as parent_title
            FROM items 
            LEFT JOIN items parent ON items.parent_id = parent.id
            WHERE 
                items.tenant_id = ? AND
                items.status IN ('decision_rejected') 
            ORDER BY items.updated_at DESC 
            LIMIT 20
        ";
        $stmtLog = $this->pdo->prepare($sqlLog);
        $stmtLog->execute([$tenantId]);
        $logItems = array_map([$this, 'mapRow'], $stmtLog->fetchAll(PDO::FETCH_ASSOC));

        return [
            'active' => $activeItems,      // Judgment
            'preparation' => $prepItems,   // Preparation (Blurry)
            'intent' => $intentItems,      // Intent (Shelf)
            'history' => $logItems         // History (Log)
        ];
    }

    /**
     * Helper: Map row types
     */
    private function mapRow($item) {
        $item['interrupt'] = (bool)$item['interrupt'];
        $item['is_boosted'] = (bool)($item['is_boosted'] ?? 0);
        $item['parentId'] = $item['parent_id'] ?? null;
        $item['isProject'] = (bool)($item['is_project'] ?? 0);
        $item['projectCategory'] = $item['project_category'] ?? null;
        $item['estimatedMinutes'] = (int)($item['estimated_minutes'] ?? 0);
        $item['assignedTo'] = $item['assigned_to'] ?? null;
        $item['projectTitle'] = $item['parent_title'] ?? null;
        
        if (!empty($item['delegation']) && is_string($item['delegation'])) {
            $item['delegation'] = json_decode($item['delegation'], true);
        }
        return $item;
    }
}
