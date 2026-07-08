/**
 * Debug configuration and build information.
 */

declare const __BUILD_TIMESTAMP__: string;

const fallbackBuildTimestamp = new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });

export const BUILD_TIMESTAMP = typeof __BUILD_TIMESTAMP__ === 'string'
    ? __BUILD_TIMESTAMP__
    : fallbackBuildTimestamp;
export const BUILD_TIME_DISPLAY = BUILD_TIMESTAMP;

export const DEBUG_MODE = (import.meta as any).env.DEV || (import.meta as any).env.VITE_DEBUG === 'true';

export const DEBUG_INFO = {
    buildTime: BUILD_TIME_DISPLAY,
    buildTimestamp: BUILD_TIMESTAMP,
    isDev: (import.meta as any).env.DEV,
    mode: (import.meta as any).env.MODE,
} as const;

export function debugLog(category: string, ...args: any[]) {
    if (DEBUG_MODE) {
        console.log(`[DEBUG:${category}]`, ...args);
    }
}

export function debugDxf(message: string, data?: any) {
    debugLog('DXF', message, data);
}
