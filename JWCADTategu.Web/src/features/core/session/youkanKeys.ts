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

	// === ガント スケール表示モード（R-097） ===
	GANTT_SCALE_MODE: 'youkan_gantt_scale_mode',
	GANTT_COL_WIDTH_MONTHLY: 'youkan_gantt_col_width_monthly',
	GANTT_ROW_HEIGHT_MONTHLY: 'youkan_gantt_row_height_monthly',
	GANTT_COL_WIDTH_WEEKLY: 'youkan_gantt_col_width_weekly',
	GANTT_ROW_HEIGHT_WEEKLY: 'youkan_gantt_row_height_weekly',
	// R-105: デイリー表示
	GANTT_COL_WIDTH_DAILY: 'youkan_gantt_col_width_daily',
	GANTT_ROW_HEIGHT_DAILY: 'youkan_gantt_row_height_daily',

	// === パノラマ設定 ===
	PANORAMA_COLS: 'youkan_panorama_cols',

	// === 全体一覧設定 ===
	OVERVIEW_FONTSIZE: 'youkan_overview_fontsize',
	OVERVIEW_COLUMNS: 'youkan_overview_columns',
	OVERVIEW_TITLE_LIMIT: 'youkan_overview_title_limit',

	// === 詳細カレンダー設定 ===
	DETAIL_CALENDAR_DENSITY: 'youkan_detail_calendar_density',

	// === 要判断キュー「捌く」（R-127） ===
	REVIEW_PROMPT_DISMISSED: 'youkan_review_prompt_dismissed',
	REVIEW_SWEEP_PENDING: 'youkan_review_sweep_pending',
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
	// R-127: 要判断キュー「捌く」
	REVIEW_QUEUE_UPDATE: 'youkan-review-queue-update',
	OPEN_REVIEW_SWEEP: 'youkan-open-review-sweep',
	// R-128: 今週の残量（F-27）。新規登録・期限/目安変更の直後、不足時のみ1回発火する
	WEEK_LOAD_SHORTFALL: 'youkan-week-load-shortfall',
} as const;
