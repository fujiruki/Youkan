<?php
// backend/GdbController.php

require_once 'BaseController.php';

class GdbController extends BaseController {

    public function __construct() {
        parent::__construct();
    }

    /**
     * Get GDB Shelf View.
     * [UUID v7] Simplified: No dual-ID format support needed
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
                 $pTenant = $pObj['tenant_id']; // NULL or string
                 // [FIX] Allow switching to Personal (NULL) if project is personal
                 if ($pTenant === $this->currentTenantId || in_array($pTenant, $this->joinedTenants) || $pTenant === null) {
                     $tenantId = $pTenant;
                 }
             }
        }
        
        // [Fix] Logic switch for Tenant vs Personal
        if ($tenantId) {
             $whereClause = "items.tenant_id = ?";
             $params = [$tenantId];
        } else {
             $whereClause = "(items.tenant_id IS NULL OR items.tenant_id = '') AND items.created_by = ?";
             $params = [$this->currentUserId];
        }
        
        // [FIX 2026-02-05] Project Focus Filter - OR logic instead of AND
        // When viewing a specific project, show items that:
        // 1. Belong to the current tenant/user (standard visibility) - OR -
        // 2. Are directly part of the focused project tree (regardless of their tenant_id)
        $whereSuffix = "";
        $projectParams = [];
        if ($projectId) {
            // Get all IDs of items in this project subtree
            $descendants = $this->getProjectDescendantIds($projectId);
            $targetIds = array_unique(array_merge([$projectId], $descendants));
            
            // [CORE FIX] Use OR logic: Show if (matches tenant filter) OR (belongs to focused project)
            $placeholders = implode(',', array_fill(0, count($targetIds), '?'));
            $projectMembershipFilter = "(items.id IN ($placeholders) OR items.project_id IN ($placeholders))";
            
            // Replace whereClause with combined OR logic
            $whereClause = "(($whereClause) OR ($projectMembershipFilter))";
            $projectParams = array_merge($targetIds, $targetIds);
        }



        // Helper parameters
        $baseParams = [$tenantId];
        $timeParams = [$now];
        
        // Active
        $sqlActive = "
            SELECT items.*, parent.title as parent_title, proj.title as real_project_title
            FROM items
            LEFT JOIN items parent ON items.parent_id = parent.id
            LEFT JOIN items proj ON items.project_id = proj.id
            WHERE
                $whereClause
                $whereSuffix
                AND items.status NOT IN ('confirmed', 'today_commit', 'execution_in_progress', 'execution_paused', 'done', 'decision_rejected', 'archive')
                AND (
                    items.status = 'inbox' 
                    OR (items.rdd_date IS NOT NULL AND items.rdd_date <= ?)
                )
                AND items.deleted_at IS NULL
            ORDER BY items.rdd_date ASC, items.created_at DESC
        ";
        
        $stmtActive = $this->pdo->prepare($sqlActive);
        // Params: tenantId, ...projectIds..., now
        // Be careful with param order.
        // SQL: WHERE tenant_id = ? ... IN (...) ... <= ?
        $paramsActive = array_merge($params, $projectParams, $timeParams);
        $stmtActive->execute($paramsActive);
        $activeItems = array_map([$this, 'mapItemRow'], $stmtActive->fetchAll(PDO::FETCH_ASSOC));

        // Preparation
        $sqlPrep = "
            SELECT items.*, parent.title as parent_title, proj.title as real_project_title
            FROM items
            LEFT JOIN items parent ON items.parent_id = parent.id
            LEFT JOIN items proj ON items.project_id = proj.id
            WHERE
                $whereClause
                $whereSuffix
                AND items.status = 'decision_hold'
                AND (items.rdd_date IS NULL OR items.rdd_date > ?)
                AND items.deleted_at IS NULL
            ORDER BY items.prep_date ASC, items.updated_at DESC
        ";
        
        $paramsPrep = array_merge($params, $projectParams, $timeParams);
        $stmtPrep = $this->pdo->prepare($sqlPrep);
        $stmtPrep->execute($paramsPrep);
        $prepItems = array_map([$this, 'mapItemRow'], $stmtPrep->fetchAll(PDO::FETCH_ASSOC));

        // Intent
        $sqlIntent = "
            SELECT items.*, parent.title as parent_title, proj.title as real_project_title
            FROM items
            LEFT JOIN items parent ON items.parent_id = parent.id
            LEFT JOIN items proj ON items.project_id = proj.id
            WHERE
                $whereClause
                $whereSuffix
                AND items.status = 'intent' 
                AND items.deleted_at IS NULL
            ORDER BY items.updated_at DESC
        ";
        $paramsIntent = array_merge($params, $projectParams);
        $stmtIntent = $this->pdo->prepare($sqlIntent);
        $stmtIntent->execute($paramsIntent);
        $intentItems = array_map([$this, 'mapItemRow'], $stmtIntent->fetchAll(PDO::FETCH_ASSOC));

        // History
        $sqlLog = "
            SELECT items.*, parent.title as parent_title, proj.title as real_project_title
            FROM items
            LEFT JOIN items parent ON items.parent_id = parent.id
            LEFT JOIN items proj ON items.project_id = proj.id
            WHERE
                $whereClause
                $whereSuffix
                AND items.status IN ('decision_rejected') 
                AND items.deleted_at IS NULL
            ORDER BY items.updated_at DESC 
            LIMIT 20
        ";
        $paramsLog = array_merge($params, $projectParams);
        $stmtLog = $this->pdo->prepare($sqlLog);
        $stmtLog->execute($paramsLog);
        $logItems = array_map([$this, 'mapItemRow'], $stmtLog->fetchAll(PDO::FETCH_ASSOC));

        return [
            'active' => $activeItems,      // Judgment
            'preparation' => $prepItems,   // Preparation (Blurry)
            'intent' => $intentItems,      // Intent (Shelf)
            'history' => $logItems         // History (Log)
        ];
    }
}
