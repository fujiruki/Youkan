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
        $projectId = $_GET['project_id'] ?? null;
        
        // [Fix] Context Switch: If Project Focus, use Project's Tenant
        if ($projectId) {
             $stmtP = $this->pdo->prepare("SELECT tenant_id FROM items WHERE id = ?");
             $stmtP->execute([$projectId]);
             $pObj = $stmtP->fetch(PDO::FETCH_ASSOC);
             if ($pObj) {
                 $pTenant = $pObj['tenant_id'] ?? '';
                 // If the project's tenant is the current one, or one the user belongs to, switch context
                 if ($pTenant === $this->currentTenantId || in_array($pTenant, $this->joinedTenants)) {
                     $tenantId = $pTenant;
                 }
             }
        }
        
        // [Fix] Project Focus Filter (Recursive)
        $whereSuffix = "";
        $projectParams = [];
        if ($projectId) {
            $descendants = $this->getProjectDescendantIds($projectId);
            if (!empty($descendants)) {
                $placeholders = implode(',', array_fill(0, count($descendants), '?'));
                $whereSuffix = " AND items.id IN ($placeholders) ";
                $projectParams = $descendants;
            } else {
                $whereSuffix = " AND 0 "; // Found nothing
            }
        }

        // Helper parameters
        $baseParams = [$tenantId];
        $timeParams = [$now];
        
        // Active
        $sqlActive = "
            SELECT items.*, parent.title as parent_title
            FROM items 
            LEFT JOIN items parent ON items.parent_id = parent.id
            WHERE 
                items.tenant_id = ? 
                $whereSuffix
                AND items.status NOT IN ('confirmed', 'today_commit', 'execution_in_progress', 'execution_paused', 'done', 'decision_rejected', 'archive')
                AND (
                    items.status = 'inbox' 
                    OR (items.rdd_date IS NOT NULL AND items.rdd_date <= ?)
                )
            ORDER BY items.rdd_date ASC, items.created_at DESC
        ";
        
        $stmtActive = $this->pdo->prepare($sqlActive);
        // Params: tenantId, ...projectIds..., now
        // Be careful with param order.
        // SQL: WHERE tenant_id = ? ... IN (...) ... <= ?
        $paramsActive = array_merge($baseParams, $projectParams, $timeParams);
        $stmtActive->execute($paramsActive);
        $activeItems = array_map([$this, 'mapRow'], $stmtActive->fetchAll(PDO::FETCH_ASSOC));

        // Preparation
        $sqlPrep = "
            SELECT items.*, parent.title as parent_title
            FROM items 
            LEFT JOIN items parent ON items.parent_id = parent.id
            WHERE 
                items.tenant_id = ? 
                $whereSuffix
                AND items.status = 'decision_hold'
                AND (items.rdd_date IS NULL OR items.rdd_date > ?)
            ORDER BY items.prep_date ASC, items.updated_at DESC
        ";
        
        $paramsPrep = array_merge($baseParams, $projectParams, $timeParams);
        $stmtPrep = $this->pdo->prepare($sqlPrep);
        $stmtPrep->execute($paramsPrep);
        $prepItems = array_map([$this, 'mapRow'], $stmtPrep->fetchAll(PDO::FETCH_ASSOC));

        // Intent
        $sqlIntent = "
            SELECT items.*, parent.title as parent_title
            FROM items 
            LEFT JOIN items parent ON items.parent_id = parent.id
            WHERE 
                items.tenant_id = ? 
                $whereSuffix
                AND items.status = 'intent' 
            ORDER BY items.updated_at DESC
        ";
        $paramsIntent = array_merge($baseParams, $projectParams);
        $stmtIntent = $this->pdo->prepare($sqlIntent);
        $stmtIntent->execute($paramsIntent);
        $intentItems = array_map([$this, 'mapRow'], $stmtIntent->fetchAll(PDO::FETCH_ASSOC));

        // History
        $sqlLog = "
            SELECT items.*, parent.title as parent_title
            FROM items 
            LEFT JOIN items parent ON items.parent_id = parent.id
            WHERE 
                items.tenant_id = ? 
                $whereSuffix
                AND items.status IN ('decision_rejected') 
            ORDER BY items.updated_at DESC 
            LIMIT 20
        ";
        $paramsLog = array_merge($baseParams, $projectParams);
        $stmtLog = $this->pdo->prepare($sqlLog);
        $stmtLog->execute($paramsLog);
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
