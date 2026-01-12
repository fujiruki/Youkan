<?php
// backend/EventService.php

class EventService {
    private $pdo;

    public function __construct($pdo) {
        $this->pdo = $pdo;
    }

    /**
     * Record a system event.
     * 
     * @param string $type Event type (e.g., 'DecisionConfirmed', 'DecisionDeferred')
     * @param array $payload Key-value pairs of event data
     * @return string Event ID
     */
    public function logIn($type, $payload) {
        $id = uniqid('evt_', true);
        $stmt = $this->pdo->prepare("INSERT INTO events (id, type, payload, created_at) VALUES (?, ?, ?, ?)");
        $stmt->execute([
            $id,
            $type,
            json_encode($payload),
            time()
        ]);
        return $id;
    }
}
