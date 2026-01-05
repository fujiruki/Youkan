/**
 * Debug Configuration
 * Controls debug mode and build information display
 */

// ビルド時刻を自動的に記録
export const BUILD_TIMESTAMP = new Date().toISOString();
export const BUILD_TIME_DISPLAY = new Date().toLocaleString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
});

// デバッグモードフラグ（開発環境では常にON）
export const DEBUG_MODE = import.meta.env.DEV || import.meta.env.VITE_DEBUG === 'true';

// デバッグ情報
export const DEBUG_INFO = {
    buildTime: BUILD_TIME_DISPLAY,
    buildTimestamp: BUILD_TIMESTAMP,
    isDev: import.meta.env.DEV,
    mode: import.meta.env.MODE,
} as const;

/**
 * デバッグログを出力（デバッグモード時のみ）
 */
export function debugLog(category: string, ...args: any[]) {
    if (DEBUG_MODE) {
        console.log(`[DEBUG:${category}]`, ...args);
    }
}

/**
 * DXF生成のデバッグログ
 */
export function debugDxf(message: string, data?: any) {
    debugLog('DXF', message, data);
}
