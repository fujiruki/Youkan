import { useCallback, useEffect, useState } from 'react';
import { ApiTokenSummary, IssuedApiToken, createApiToken, listApiTokens, revokeApiToken } from '../repositories/ApiTokenRepository';

/**
 * R-140: 個人設定「外部連携トークン」の ViewModel。
 * 発行直後の平文トークンは issued に保持し、再読込で消える（再表示しない）。
 */
export function useApiTokens() {
    const [tokens, setTokens] = useState<ApiTokenSummary[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [issued, setIssued] = useState<IssuedApiToken | null>(null);
    const [error, setError] = useState<string | null>(null);

    const reload = useCallback(async () => {
        try {
            setTokens(await listApiTokens());
            setError(null);
        } catch (e) {
            setError(e instanceof Error ? e.message : '読み込みに失敗しました');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => { void reload(); }, [reload]);

    const issue = useCallback(async (label: string) => {
        const res = await createApiToken(label);
        setIssued(res);
        await reload();
    }, [reload]);

    const revoke = useCallback(async (id: string) => {
        await revokeApiToken(id);
        setTokens(prev => prev.filter(t => t.id !== id));
        setIssued(prev => (prev && prev.id === id ? null : prev));
    }, []);

    return { tokens, isLoading, issued, error, issue, revoke };
}
