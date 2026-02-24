import { useState, useEffect, useCallback } from 'react';
import { Item } from '../features/core/youkan/types';
import { ApiClient } from '../api/client';

// ViewModel Return Type
interface UseFocusQueueResult {
    // Data
    items: Item[];
    loading: boolean;
    error: string | null;

    // Derived State (Capacity)
    capacityUsed: number; // Minutes
    capacityLimit: number; // e.g., 480
    isOverCapacity: boolean;

    // Actions
    reorder: (newOrder: Item[]) => Promise<void>;
    refresh: () => Promise<void>;
    setEngaged: (id: string, isEngaged: boolean) => Promise<void>;
}

export const useFocusQueue = (currentCapacityLimit: number = 480, projectId?: string): UseFocusQueueResult => {
    // ... (unchanged)
    const [items, setItems] = useState<Item[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchQueue = useCallback(async () => {
        // ... (unchanged)
        setLoading(true);
        try {
            const data = await ApiClient.getAllItems({ scope: 'dashboard', project_id: projectId });
            const sorted = (data || [])
                .filter(i => ['focus', 'ready', 'pending'].includes(i.status))
                .sort((a, b) => (a.focusOrder || 0) - (b.focusOrder || 0));

            // Map API 'isIntent' to 'isEngaged' if necessary, assuming API returns 'isIntent'
            const mappedItems = sorted.map((item: any) => ({
                ...item,
                isEngaged: item.isIntent ?? item.isEngaged // Support both
            }));

            setItems(mappedItems as Item[]);
            setError(null);
        } catch (err: any) { // ...
            console.error(err);
            setError('Failed to load focus queue');
        } finally {
            setLoading(false);
        }
    }, []);

    // Initial Load
    useEffect(() => {
        fetchQueue();
    }, [fetchQueue]);

    // Capacity Logic
    const capacityUsed = items.reduce((sum, item) => sum + (item.estimatedMinutes || 0), 0);
    const isOverCapacity = capacityUsed > currentCapacityLimit;

    // Actions
    const reorder = async (newOrder: Item[]) => {
        // Optimistic Update
        setItems(newOrder);

        // Prepare payload: { items: [{ id, order }] }
        const payload = {
            items: newOrder.map((item, index) => ({
                id: item.id,
                order: index + 1
            }))
        };

        try {
            // Post to action=reorder_focus using generic request since no specific method exists yet
            await ApiClient.request('POST', '/items?action=reorder_focus', payload);
        } catch (err) {
            console.error('Reorder failed', err);
            // Revert? (Optional strategy: fetchQueue)
            fetchQueue();
        }
    };
    const setEngaged = async (id: string, isEngaged: boolean) => {
        // Optimistic
        setItems(prev => prev.map(item =>
            item.id === id ? { ...item, isEngaged, status: isEngaged ? 'focus' : item.status } : item
        ));

        try {
            // Use updateItem wrapper - IMPORTANT: Include status change to 'focus'
            // Map 'isEngaged' back to 'isIntent' for API compatibility
            await ApiClient.updateItem(id, {
                ['isIntent' as keyof Item]: isEngaged, // Force key if strict, or use cast
                status: isEngaged ? 'focus' : undefined,
                dueStatus: isEngaged ? 'today' : undefined
            } as any);
        } catch (err) {
            console.error('Set Engaged failed', err);
            fetchQueue();
        }
    };

    return {
        items,
        loading,
        error,
        capacityUsed,
        capacityLimit: currentCapacityLimit,
        isOverCapacity,
        reorder,
        refresh: fetchQueue,
        setEngaged
    };
};
