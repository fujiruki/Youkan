import { ApiClient } from '../../../../api/client';

/**
 * R-140: 連携トークン（api_tokens）の発行／一覧／失効。
 * API 定義は docs/SPEC/04_データ設計.md §5.1（/user/api-tokens）。
 */
export interface ApiTokenSummary {
    id: string;
    label: string;
    createdAt: number | null; // Unix秒
    lastUsedAt: number | null; // Unix秒。未使用なら null
}

export interface IssuedApiToken {
    id: string;
    label: string;
    token: string; // 平文。発行レスポンスでのみ得られる
}

interface ApiTokenRow {
    id: string;
    label: string;
    created_at: number | null;
    last_used_at: number | null;
}

export const listApiTokens = async (): Promise<ApiTokenSummary[]> => {
    const rows = await ApiClient.request<ApiTokenRow[]>('GET', '/user/api-tokens');
    return rows.map(r => ({ id: r.id, label: r.label, createdAt: r.created_at, lastUsedAt: r.last_used_at }));
};

export const createApiToken = (label: string): Promise<IssuedApiToken> =>
    ApiClient.request<IssuedApiToken>('POST', '/user/api-tokens', { label });

export const revokeApiToken = async (id: string): Promise<void> => {
    await ApiClient.request('DELETE', `/user/api-tokens/${encodeURIComponent(id)}`);
};
