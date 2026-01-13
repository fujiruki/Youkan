<?php
// backend/ItemController.php

class ItemController {
    
    public static function getAll($db) {
        $stmt = $db->query("SELECT * FROM items");
        $items = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        // SQLite stores booleans as 0/1, convert back if needed
        foreach ($items as &$item) {
            $item['interrupt'] = (bool)$item['interrupt'];
            $item['is_boosted'] = (bool)($item['is_boosted'] ?? 0);
        }
        return $items;
    }

    public static function create($db, $data) {
        $sql = "INSERT INTO items (id, title, status, created_at, updated_at, status_updated_at) VALUES (:id, :title, :status, :now, :now, :now)";
        $stmt = $db->prepare($sql);
        
        $id = $data['id'] ?? uniqid('item_', true); // Basic ID gen if not provided
        $now = time();
        
        $stmt->execute([
            ':id' => $id,
            ':title' => $data['title'],
            ':status' => $data['status'] ?? 'inbox',
            ':now' => $now
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
