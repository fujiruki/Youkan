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
};
