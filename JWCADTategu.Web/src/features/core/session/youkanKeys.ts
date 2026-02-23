/**
 * Youkan 定数モジュール
 * 
 * すべての localStorage キーとカスタムイベント名を一箇所で管理する。
 * 各ファイルでは文字列リテラルではなく、この定数を import して使用すること。
 */

/** localStorage キー名 */
export const YOUKAN_KEYS = {
	// === 認証系 ===
	TOKEN: 'youkan_token',
	USER: 'youkan_user',
	TENANT: 'youkan_tenant',
	JOINED_TENANTS: 'youkan_joined_tenants',
	ACCOUNT_TYPE: 'youkan_account_type',

	// === フィルタ・表示モード ===
	FILTER_MODE: 'youkan_filter_mode',
	VIEW_MODE: 'youkan_view_mode',
	HIDE_COMPLETED: 'youkan_hide_completed',
	SHOW_LIFE_MODE: 'youkan_show_life_mode',
	PROJECT_VIEW_MODE: 'youkan_project_view_mode',
	CALENDAR_VIEW_MODE: 'youkan_calendar_view_mode',

	// === ガントチャート設定 ===
	GANTT_ROW_HEIGHT: 'youkan_gantt_row_height',
	GANTT_SHOW_GROUPS: 'youkan_gantt_show_groups',

	// === パノラマ設定 ===
	PANORAMA_COLS: 'youkan_panorama_cols',

	// === 新聞ボード設定 ===
	NEWSPAPER_FONTSIZE: 'youkan_newspaper_fontsize',
	NEWSPAPER_COLUMNS: 'youkan_newspaper_columns',
	NEWSPAPER_TITLE_LIMIT: 'youkan_newspaper_title_limit',
} as const;

/** カスタムイベント名 */
export const YOUKAN_EVENTS = {
	FILTER_CHANGE: 'youkan-filter-change',
	VIEW_MODE_CHANGE: 'youkan-view-mode-change',
	DATA_CHANGED: 'youkan-data-changed',
	CAPACITY_UPDATE: 'youkan-capacity-update',
	OPEN_PROJECT_MODAL: 'youkan-open-project-modal',
	CALENDAR_VIEW_MODE_CHANGE: 'youkan-calendar-view-mode-change',
	PROJECT_VIEW_MODE_CHANGE: 'youkan-project-view-mode-change',
} as const;
