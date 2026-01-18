/**
 * useStocks Hook
 * JBWOS Enterprise: Stock (Unassigned Jobs) management
 */
import { useState, useCallback } from 'react';
import { StockJob, StockStatus } from '../types';

const API_BASE = '/api/stocks';

export function useStocks() {
    const [stocks, setStocks] = useState<StockJob[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchStocks = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(API_BASE);
            if (!res.ok) throw new Error('Failed to fetch stocks');
            const data = await res.json();
            setStocks(data);
        } catch (e) {
            console.error(e);
            setError('Stock情報の取得に失敗しました');
        } finally {
            setLoading(false);
        }
    }, []);

    const updateStockStatus = async (id: string, status: StockStatus, projectId?: string) => {
        try {
            const res = await fetch(`${API_BASE}/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status, project_id: projectId })
            });
            if (!res.ok) throw new Error('Failed to update stock');

            // Optimistic update or refetch
            setStocks(prev => prev.map(s => s.id === id ? { ...s, status } : s));
            return true;
        } catch (e) {
            console.error(e);
            return false;
        }
    };

    return {
        stocks,
        loading,
        error,
        fetchStocks,
        updateStockStatus
    };
}
