import { useState, useCallback, useEffect } from 'react';
import { Item } from '../types';
import { JBWOSRepository } from '../repositories/JBWOSRepository';

export interface DashboardState {
    focusItems: Item[];
    inboxItems: Item[];
    pendingItems: Item[];
    waitingItems: Item[];
    doneItems: Item[];
    isLoading: boolean;
    error: string | null;
}

export const useDashboardViewModel = () => {
    const [state, setState] = useState<DashboardState>({
        focusItems: [],
        inboxItems: [],
        pendingItems: [],
        waitingItems: [],
        doneItems: [],
        isLoading: true,
        error: null
    });

    const refresh = useCallback(async () => {
        // Don't set loading to true on refresh to avoid flickering if already loaded
        // Only set it initially? Or use a separate isRefetching?
        // sticking to simple isLoading for first load, maybe manage it better.
        // For now, let's keep it simple.

        try {
            const items = await JBWOSRepository.getDashboardItems();

            // Grouping Logic
            // Note: sort by updatedAt? or weight?
            // Backend sorts by updatedAt DESC.

            const focus = items.filter(i => i.status === 'focus');
            const inbox = items.filter(i => i.status === 'inbox'); // Urgent (Due) items should be highlighted in UI
            const pending = items.filter(i => i.status === 'pending');
            const waiting = items.filter(i => i.status === 'waiting');
            const done = items.filter(i => i.status === 'done').slice(0, 10); // Limit history

            setState({
                focusItems: focus,
                inboxItems: inbox,
                pendingItems: pending,
                waitingItems: waiting,
                doneItems: done,
                isLoading: false,
                error: null
            });
        } catch (e) {
            console.error(e);
            setState(prev => ({ ...prev, isLoading: false, error: 'Failed to load dashboard items.' }));
        }
    }, []);

    useEffect(() => {
        refresh();

        const handleGlobalRefresh = () => {
            refresh();
        };

        window.addEventListener('jbwos-data-changed', handleGlobalRefresh);
        return () => window.removeEventListener('jbwos-data-changed', handleGlobalRefresh);
    }, [refresh]);

    // Actions
    const moveToFocus = async (id: string) => {
        // Optimistic Update can be added here
        try {
            await JBWOSRepository.updateItemGeneric(id, { status: 'focus' });
            refresh();
        } catch (e) { console.error(e); }
    };

    const moveToPending = async (id: string, reason?: string) => {
        try {
            const updates: any = { status: 'pending' };
            if (reason) updates.memo = reason; // Use memo for reason or pendingReason?
            // types.ts has 'waitingReason' but maybe not 'pendingReason'.
            // using memo is safe for generic notes.
            await JBWOSRepository.updateItemGeneric(id, updates);
            refresh();
        } catch (e) { console.error(e); }
    };

    const moveToInbox = async (id: string) => {
        try {
            await JBWOSRepository.updateItemGeneric(id, { status: 'inbox' });
            refresh();
        } catch (e) { console.error(e); }
    };

    const completeItem = async (id: string) => {
        try {
            await JBWOSRepository.updateItemGeneric(id, { status: 'done' });
            refresh();
        } catch (e) { console.error(e); }
    };

    return {
        ...state,
        refresh,
        moveToFocus,
        moveToPending,
        moveToInbox,
        completeItem
    };
};
