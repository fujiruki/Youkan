import { useMemo, useState, useCallback, useEffect } from 'react';
import { JudgableItem, JBWOSState, JudgmentStatus } from './types';

// Constants strictly defined by the Constitution
const READY_LIMIT = 2; // Strict limit
const INBOX_WARNING_THRESHOLD = 7;

/**
 * Adapter Interface
 * The Engine uses this to communicate with the outside world (DB, API, etc.)
 */
export interface JudgmentAdapter {
    fetchItems(): Promise<JudgableItem[]>;
    updateItemStatus(id: string | number, status: JudgmentStatus): Promise<void>;
}

export function useJWOSEngine(adapter: JudgmentAdapter) {
    const [items, setItems] = useState<JudgableItem[]>([]);
    const [lastAction, setLastAction] = useState<{ type: 'move', from: JudgmentStatus, to: JudgmentStatus } | null>(null);

    // Initial Load
    useEffect(() => {
        load();
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const load = useCallback(async () => {
        const data = await adapter.fetchItems();
        setItems(data);
    }, [adapter]);

    // Derived State
    const inboxItems = useMemo(() => items.filter(i => i.status === 'inbox'), [items]);
    const readyItems = useMemo(() => items.filter(i => i.status === 'ready'), [items]);
    const waitingItems = useMemo(() => items.filter(i => i.status === 'waiting'), [items]);
    const pendingItems = useMemo(() => items.filter(i => i.status === 'pending'), [items]);

    const isInboxOverflowing = inboxItems.length > INBOX_WARNING_THRESHOLD;

    // Stopping Event Logic:
    // If Ready becomes empty AND the last action was moving something out of Ready (presumably to Done).
    const isStoppingEvent = useMemo(() => {
        if (readyItems.length === 0 && lastAction?.from === 'ready' && lastAction?.to === 'done') {
            return true;
        }
        return false;
    }, [readyItems.length, lastAction]);

    // Logic: Can we add more to Ready?
    const canMoveToReady = useCallback(() => {
        return readyItems.length < READY_LIMIT;
    }, [readyItems.length]);

    // Action: Move Item
    const move = useCallback(async (id: string | number, to: JudgmentStatus) => {
        const item = items.find(i => i.id === id);
        if (!item) return;

        // Constraint Checks
        if (to === 'ready') {
            if (readyItems.length >= READY_LIMIT) {
                if (window.confirm('Readyの上限（2件）を超えます。本当に移動しますか？ (本来はブロックすべきです)')) {
                    // Allow for now or strictly block? Constitution says "Stop".
                    // But if replacing, maybe swap? 
                    // For now, let's strictly throw or return false.
                    throw new Error("今日は、これ以上決めなくて大丈夫です（Ready Limit Reached）");
                } else {
                    return;
                }
            }
        }

        // Optimistic Update
        const previousStatus = item.status;
        setItems(prev => prev.map(i => i.id === id ? { ...i, status: to } : i));
        setLastAction({ type: 'move', from: previousStatus, to: to });

        try {
            await adapter.updateItemStatus(id, to);
        } catch (e) {
            // Revert on failure
            console.error("Failed to update status", e);
            setItems(prev => prev.map(i => i.id === id ? { ...i, status: previousStatus } : i));
            throw e;
        }
    }, [items, readyItems.length, adapter]);

    return {
        items,
        inboxItems,
        readyItems,
        waitingItems,
        pendingItems,
        isInboxOverflowing,
        isStoppingEvent,
        canMoveToReady,
        move,
        reload: load
    };
}
