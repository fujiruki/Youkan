import { useState, useEffect, useCallback } from 'react';
import { Item } from '../features/core/jbwos/types';
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
    setIntent: (id: string, isIntent: boolean) => Promise<void>;
}

export const useFocusQueue = (currentCapacityLimit: number = 480): UseFocusQueueResult => {
    const [items, setItems] = useState<Item[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchQueue = useCallback(async () => {
        setLoading(true);
        // Scope 'dashboard' aggregates personal + company items (Life-Work Integration)
        try {
            // Fetch items using static class method
            const data = await ApiClient.getAllItems({ scope: 'dashboard' });

            // Filter focus/judgable items
            // Assuming data is JudgableItem[] which extends Item (or compatible)
            const sorted = (data || [])
                .filter(i => ['focus', 'ready', 'pending'].includes(i.status))
                .sort((a, b) => (a.focusOrder || 0) - (b.focusOrder || 0));

            setItems(sorted as Item[]);
            setError(null);
        } catch (err: any) {
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

    const setIntent = async (id: string, isIntent: boolean) => {
        // Optimistic
        setItems(prev => prev.map(item =>
            item.id === id ? { ...item, isIntent } : item
        ));

        // Also update local list status to ensure UI responsiveness?
        // Actually intent implies "Focus" and "Due Today".

        try {
            // Use updateItem wrapper
            await ApiClient.updateItem(id, { isIntent, dueStatus: isIntent ? 'today' : undefined });
        } catch (err) {
            console.error('Set Intent failed', err);
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
        setIntent
    };
};
