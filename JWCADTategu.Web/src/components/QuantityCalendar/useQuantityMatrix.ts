import { useState, useEffect } from 'react';
// import { useAuth } from '../../../hooks/useAuth'; // Removed unused import 
// For now, using standard fetch with token if available.

export interface QuantityMatrixData {
    capacity: number;
    usage: number;
    fillRate: number;
    isOverflow: boolean;
}

export interface UseQuantityMatrixResult {
    matrix: Record<string, QuantityMatrixData>;
    loading: boolean;
    error: string | null;
    refresh: () => void;
}

export const useQuantityMatrix = (startDate: string, endDate: string, context: 'all' | 'company' | 'personal'): UseQuantityMatrixResult => {
    const [matrix, setMatrix] = useState<Record<string, QuantityMatrixData>>({});
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    const fetchData = async () => {
        setLoading(true);
        setError(null);
        try {
            const token = localStorage.getItem('jbwos_token'); // Correct key from ApiClient
            const headers: HeadersInit = {
                'Content-Type': 'application/json',
            };
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const params = new URLSearchParams({
                start: startDate,
                end: endDate,
                context: context
            });

            const response = await fetch(`/api/quantity/matrix?${params.toString()}`, {
                method: 'GET',
                headers
            });

            if (!response.ok) {
                throw new Error(`API Error: ${response.statusText}`);
            }

            const data = await response.json();
            setMatrix(data.matrix); // { "2026-02-01": { capacity: 480, ... } }
        } catch (err: any) {
            console.error("Failed to fetch quantity matrix:", err);
            setError(err.message || 'Unknown error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (startDate && endDate) {
            fetchData();
        }
    }, [startDate, endDate, context]);

    return { matrix, loading, error, refresh: fetchData };
};
