<?php
// backend/ItemController.php

class ItemController {
    
    public static function mapRow($item) {
        $item['interrupt'] = (bool)$item['interrupt'];
        $item['is_boosted'] = (bool)($item['is_boosted'] ?? 0);
        
        // Map DB snake_case to Frontend camelCase/Expected fields
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

    public static function getAll($db) {
        $sql = "
            SELECT items.*, parent.title as parent_title
            FROM items
            LEFT JOIN items parent ON items.parent_id = parent.id
        ";
        $stmt = $db->query($sql);
        $items = $stmt->fetchAll(PDO::FETCH_ASSOC);
        return array_map([self::class, 'mapRow'], $items);
    }

    public static function create($db, $data) {
        $sql = "INSERT INTO items (
            id, title, status, created_at, updated_at, status_updated_at,
            parent_id, is_project, project_category, estimated_minutes, assigned_to, delegation
        ) VALUES (
            :id, :title, :status, :now, :now, :now,
            :parent_id, :is_project, :project_category, :estimated_minutes, :assigned_to, :delegation
        )";
        $stmt = $db->prepare($sql);
        
        $id = $data['id'] ?? uniqid('item_', true); // Basic ID gen if not provided
        $now = time();
        
        $delegationJson = isset($data['delegation']) ? json_encode($data['delegation']) : null;
        
        $stmt->execute([
            ':id' => $id,
            ':title' => $data['title'],
            ':status' => $data['status'] ?? 'inbox',
            ':now' => $now,
            ':parent_id' => $data['parentId'] ?? null,
            ':is_project' => ($data['isProject'] ?? false) ? 1 : 0,
            ':project_category' => $data['projectCategory'] ?? null,
            ':estimated_minutes' => $data['estimatedMinutes'] ?? 0,
            ':assigned_to' => $data['assignedTo'] ?? null,
            ':delegation' => $delegationJson
        ]);
        
        return ['id' => $id, 'success' => true];
    }

    public static function update($db, $id, $data) {
        $fields = [];
        $params = [':id' => $id];
        
        if (isset($data['title'])) {
            $fields[] = "title = :title";
            $params[':title'] = $data['title'];
        }
        if (isset($data['status'])) {
            $fields[] = "status = :status";
            $params[':status'] = $data['status'];
            $fields[] = "status_updated_at = :now";
            $params[':now'] = time();
        }
        if (isset($data['memo'])) {
            $fields[] = "memo = :memo";
            $params[':memo'] = $data['memo'];
        }
        if (array_key_exists('due_date', $data)) {
            $fields[] = "due_date = :due_date";
            $params[':due_date'] = $data['due_date'];
        }
        if (array_key_exists('due_status', $data)) {
            $fields[] = "due_status = :due_status";
            $params[':due_status'] = $data['due_status'];
        }
        if (array_key_exists('is_boosted', $data)) {
            $fields[] = "is_boosted = :is_boosted";
            $params[':is_boosted'] = $data['is_boosted'] ? 1 : 0;
        }
        if (array_key_exists('boosted_date', $data)) {
            $fields[] = "boosted_date = :boosted_date";
            $params[':boosted_date'] = $data['boosted_date'];
        }
        // [v2] Preparation Date (Blurry Target)
        // Advisory only. No validation.
        if (array_key_exists('prep_date', $data)) {
            $fields[] = "prep_date = :prep_date";
            $params[':prep_date'] = $data['prep_date'];
        }
        
        // [v6] New Fields
        if (array_key_exists('parentId', $data)) {
            $fields[] = "parent_id = :parent_id";
            $params[':parent_id'] = $data['parentId'];
        }
        if (array_key_exists('isProject', $data)) {
            $fields[] = "is_project = :is_project";
            $params[':is_project'] = $data['isProject'] ? 1 : 0;
        }
        if (array_key_exists('projectCategory', $data)) {
            $fields[] = "project_category = :project_category";
            $params[':project_category'] = $data['projectCategory'];
        }
        if (array_key_exists('estimatedMinutes', $data)) {
            $fields[] = "estimated_minutes = :estimated_minutes";
            $params[':estimated_minutes'] = $data['estimatedMinutes'];
        }
        if (array_key_exists('assignedTo', $data)) {
            $fields[] = "assigned_to = :assigned_to";
            $params[':assigned_to'] = $data['assignedTo'];
        }
        if (array_key_exists('delegation', $data)) {
            $fields[] = "delegation = :delegation";
            $params[':delegation'] = isset($data['delegation']) ? json_encode($data['delegation']) : null;
        }
        
        $fields[] = "updated_at = " . time();
        
        if (empty($fields)) return ['success' => true, 'changed' => false];
        
        $sql = "UPDATE items SET " . implode(', ', $fields) . " WHERE id = :id";
        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        
        return ['success' => true];
    }

    public static function delete($db, $id) {
        $stmt = $db->prepare("DELETE FROM items WHERE id = :id");
        $stmt->execute([':id' => $id]);
        return ['success' => true];
    }
}
