import { ApiClient } from './client';

export interface GoogleOAuthStartResponse {
    authUrl: string;
}

export interface GoogleOAuthStatus {
    connected: boolean;
    email?: string;
    lastSyncAt?: number;
}

export interface GoogleCalendarRefreshResponse {
    count: number;
}

/**
 * R-041: ユーザーが連携している Google カレンダー 1 行分。
 * バックエンドの `user_google_calendars` テーブル相当（snake_case→camelCase 変換済）。
 */
export interface GoogleCalendar {
    id: number;
    calendarId: string;
    summary: string;
    colorHex: string;
    isEnabled: boolean;
    sortOrder: number;
}

interface GoogleCalendarRow {
    id: number;
    calendar_id: string;
    summary: string;
    color_hex: string;
    is_enabled: boolean | 0 | 1;
    sort_order: number;
}

const toCalendar = (row: GoogleCalendarRow): GoogleCalendar => ({
    id: row.id,
    calendarId: row.calendar_id,
    summary: row.summary,
    colorHex: row.color_hex,
    isEnabled: row.is_enabled === true || row.is_enabled === 1,
    sortOrder: row.sort_order,
});

/**
 * R-034 Phase 2: Google カレンダー OAuth / 同期 API ラッパー
 *
 * - エンドポイントは docs/SPEC/04_データ設計.md §5.1 に準拠
 * - Y1 Agent 実装中のバックエンドと結合する
 */
export const GoogleCalendarApi = {
    /**
     * OAuth 認可フローを開始し、Google の認可 URL を取得する。
     * 呼び出し側で window.location.href / window.open へ遷移させる。
     */
    async startOAuth(): Promise<GoogleOAuthStartResponse> {
        return ApiClient.request<GoogleOAuthStartResponse>('POST', '/google/oauth/start');
    },

    /**
     * 連携状態を取得する。未連携なら connected=false、連携済みなら email/lastSyncAt を含む。
     * silent=true で global error handler 抑制（未連携は正常パスのため）。
     */
    async getStatus(): Promise<GoogleOAuthStatus> {
        return ApiClient.request<GoogleOAuthStatus>('GET', '/google/oauth/status', undefined, true);
    },

    /**
     * 手動更新（60 秒クールダウン）。429 は呼び出し側で握る。
     */
    async refresh(): Promise<GoogleCalendarRefreshResponse> {
        return ApiClient.request<GoogleCalendarRefreshResponse>('POST', '/google/calendar/refresh');
    },

    /**
     * 連携解除。トークン＋キャッシュをサーバ側で削除。
     */
    async revoke(): Promise<void> {
        await ApiClient.request<void>('DELETE', '/google/oauth');
    },

    /**
     * R-041: ユーザーが連携している Google カレンダー一覧を取得。
     * サーバ側で Google `calendarList.list` を呼び `user_google_calendars` を更新したうえで返す。
     * 未連携時は API 側でエラーを返すため silent=true で握る。
     */
    async getGoogleCalendars(): Promise<{ calendars: GoogleCalendar[] }> {
        const res = await ApiClient.request<{ calendars: GoogleCalendarRow[] }>(
            'GET',
            '/google/calendars',
            undefined,
            true,
        );
        return { calendars: (res.calendars ?? []).map(toCalendar) };
    },

    /**
     * R-041: 指定カレンダーの表示 ON/OFF を切り替える。
     * バックエンドは `{success, id, is_enabled}` を返す。フロントは camelCase の最小行で受け取る。
     */
    async updateGoogleCalendar(id: number, isEnabled: boolean): Promise<GoogleCalendar> {
        const res = await ApiClient.request<{ success: boolean; id: number; is_enabled: boolean }>(
            'PATCH',
            `/google/calendars/${id}`,
            { is_enabled: isEnabled },
        );
        // 既存の他フィールドは呼び出し側の楽観的 state を維持。返却は id と isEnabled のみ確実。
        return {
            id: res.id,
            calendarId: '',
            summary: '',
            colorHex: '',
            isEnabled: res.is_enabled === true,
            sortOrder: 0,
        };
    },
};
