<?php
/**
 * UUID v7 Generator (PHP Native Implementation)
 * 
 * UUID v7 は時間順にソート可能な UUID で、以下の構造を持つ:
 * - 48 bits: Unix timestamp in milliseconds
 * - 4 bits: Version (7)
 * - 12 bits: Random
 * - 2 bits: Variant (10)
 * - 62 bits: Random
 * 
 * 総計: 128 bits = 36 文字 (ハイフン含む)
 */
class Uuidv7 {

    /**
     * Generate a UUID v7 string.
     * 
     * @return string UUID v7 (例: 018dbc9a-5c7e-7012-8abc-def012345678)
     */
    public static function generate(): string {
        // 1. Get current time in milliseconds (48 bits)
        $timestampMs = (int)(microtime(true) * 1000);
        
        // 2. Generate random bytes (10 bytes = 80 bits)
        $randomBytes = random_bytes(10);
        
        // 3. Build UUID
        // Timestamp: 48 bits (6 bytes worth, but we pack as hex)
        $timeLow = ($timestampMs >> 16) & 0xFFFFFFFF;
        $timeMid = $timestampMs & 0xFFFF;
        
        // Version (7) + random_a (12 bits)
        $randA = ord($randomBytes[0]) << 4 | (ord($randomBytes[1]) >> 4);
        $versionRandA = 0x7000 | ($randA & 0x0FFF);
        
        // Variant (10) + random_b (62 bits packed into remaining bytes)
        $variantRandB = (0x80 | (ord($randomBytes[1]) & 0x3F)); // First byte: variant + 6 random bits
        
        // Construct UUID
        $uuid = sprintf(
            '%08x-%04x-%04x-%02x%02x-%02x%02x%02x%02x%02x%02x',
            $timeLow,
            $timeMid,
            $versionRandA,
            $variantRandB,
            ord($randomBytes[2]),
            ord($randomBytes[3]),
            ord($randomBytes[4]),
            ord($randomBytes[5]),
            ord($randomBytes[6]),
            ord($randomBytes[7]),
            ord($randomBytes[8]),
            ord($randomBytes[9])
        );
        
        return $uuid;
    }

    /**
     * Validate if a string is a valid UUID v7 format.
     * 
     * @param string $uuid
     * @return bool
     */
    public static function isValid(string $uuid): bool {
        // UUID format: 8-4-4-4-12 hex chars
        if (!preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i', $uuid)) {
            return false;
        }
        return true;
    }

    /**
     * Extract timestamp from UUID v7 (for debugging/sorting verification).
     * 
     * @param string $uuid
     * @return int Unix timestamp in milliseconds
     */
    public static function extractTimestamp(string $uuid): int {
        // Remove hyphens
        $hex = str_replace('-', '', $uuid);
        
        // First 12 hex chars (48 bits) = timestamp
        $timestampHex = substr($hex, 0, 12);
        
        return hexdec($timestampHex);
    }
}
