import { useState, useCallback } from 'react';
import { ApiClient } from '../../../../api/client';

const MAX_NAMES = 30;

interface UseRecentClientNamesResult {
    names: string[];
    fetch: () => void;
    loading: boolean;
}

export const useRecentClientNames = (): UseRecentClientNamesResult => {
    const [names, setNames] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);

    const fetch = useCallback(async () => {
        setLoading(true);
        try {
            const projects = await ApiClient.getProjects({ scope: 'aggregated' });
            const seen = new Set<string>();
            const result: string[] = [];

            const sorted = [...projects].sort((a, b) => {
                const ta = new Date(a.updatedAt ?? a.updated_at ?? 0).getTime();
                const tb = new Date(b.updatedAt ?? b.updated_at ?? 0).getTime();
                return tb - ta;
            });

            for (const p of sorted) {
                const raw = p.clientName ?? p.client ?? '';
                const name = typeof raw === 'string' ? raw.trim() : '';
                if (!name) continue;
                if (seen.has(name)) continue;
                seen.add(name);
                result.push(name);
                if (result.length >= MAX_NAMES) break;
            }

            setNames(result);
        } catch {
            setNames([]);
        } finally {
            setLoading(false);
        }
    }, []);

    return { names, fetch, loading };
};
