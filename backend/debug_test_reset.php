<?php
require 'db.php';
$db = getDB();
// Set boosted_date to 2 days ago (ms)
$oldDate = (time() - 86400 * 2) * 1000;
$count = $db->exec("UPDATE items SET boosted_date = $oldDate WHERE title = 'Test Boost Item' AND is_boosted = 1");
echo "Updated $count items to have old boosted_date.";
