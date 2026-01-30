<?php
require_once 'db.php';
$pdo = getDB();

$stmt = $pdo->query("SELECT id, name FROM tenants LIMIT 5");
$tenants = $stmt->fetchAll();

echo "Tenants:\n";
print_r($tenants);

$stmt = $pdo->query("SELECT user_id, tenant_id, role FROM memberships LIMIT 5");
$memberships = $stmt->fetchAll();

echo "Memberships:\n";
print_r($memberships);
