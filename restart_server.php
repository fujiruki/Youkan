<?php
// Win32 API to find window/process might be hard in pure PHP without extensions.
// Instead we use taskkill by port? No, netstat to find PID then kill.

$port = 8000;
$output = [];
exec("netstat -ano | findstr :$port", $output);

foreach ($output as $line) {
    if (preg_match('/:8000\s+LISTENING\s+(\d+)/', $line, $matches)) {
        $pid = $matches[1];
        echo "Killing PHP server on PID: $pid\n";
        exec("taskkill /F /PID $pid");
    }
}

echo "Starting PHP server on 127.0.0.1:8000...\n";
// Start in background. PowerSHELL 'Start-Process' is better but from PHP `pclose(popen(...))` works usually.
// Actually, I can't easily start a background process that survives from PHP CLI on Windows without some tricks.
// Better to just Kill here, and verify it's dead. Then use run_command separately to start it.
