const SCHEMA_VERSION_KEY = 'youkan_schema_version';
const CURRENT_VERSION = '2';

export const migrateLocalStorage = (): void => {
    const current = localStorage.getItem(SCHEMA_VERSION_KEY);
    if (current === CURRENT_VERSION) return;
    if (current !== null && Number(current) > Number(CURRENT_VERSION)) return;

    const viewMode = localStorage.getItem('youkan_view_mode');
    if (viewMode === 'board') localStorage.setItem('youkan_view_mode', 'panorama');
    if (viewMode === 'newspaper') localStorage.setItem('youkan_view_mode', 'overview');

    const moves: [string, string][] = [
        ['youkan_newspaper_fontsize', 'youkan_overview_fontsize'],
        ['youkan_newspaper_columns', 'youkan_overview_columns'],
        ['youkan_newspaper_title_limit', 'youkan_overview_title_limit'],
    ];
    for (const [oldKey, newKey] of moves) {
        const v = localStorage.getItem(oldKey);
        if (v !== null && localStorage.getItem(newKey) === null) {
            localStorage.setItem(newKey, v);
        }
        if (v !== null) {
            localStorage.removeItem(oldKey);
        }
    }

    localStorage.setItem(SCHEMA_VERSION_KEY, CURRENT_VERSION);
};
