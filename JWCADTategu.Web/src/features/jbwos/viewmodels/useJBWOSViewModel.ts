import { useState, useEffect, useCallback } from 'react';
import { JBWOSRepository } from '../repositories/JBWOSRepository';
import { Item } from '../types';

export const useJBWOSViewModel = () => {
    // Repository is a singleton object imported directly

    const [inboxItems, setInboxItems] = useState<Item[]>([]);
    const [scheduledItems, setScheduledItems] = useState<Item[]>([]);
    const [readyItems, setReadyItems] = useState<Item[]>([]);
    const [waitingItems, setWaitingItems] = useState<Item[]>([]);
    const [executionItems, setExecutionItems] = useState<Item[]>([]);
    const [pendingItems, setPendingItems] = useState<Item[]>([]);
    const [doneItems, setDoneItems] = useState<Item[]>([]);

    const refresh = useCallback(async () => {
        // Cast results to Item[] as Repository might return slightly different interface
        // but runtime data is compatible.
        setInboxItems((await JBWOSRepository.getItemsByStatus('inbox')) as Item[]);
        setScheduledItems((await JBWOSRepository.getItemsByStatus('scheduled')) as Item[]);
        setWaitingItems((await JBWOSRepository.getItemsByStatus('waiting')) as Item[]);
        setReadyItems((await JBWOSRepository.getItemsByStatus('ready')) as Item[]);
        setExecutionItems((await JBWOSRepository.getItemsByStatus('execution')) as Item[]);
        setPendingItems((await JBWOSRepository.getItemsByStatus('pending')) as Item[]);
        setDoneItems((await JBWOSRepository.getItemsByStatus('done')) as Item[]);
    }, []);

    // Initial Load
    useEffect(() => {
        refresh();
    }, [refresh]);

    // --- Action History (Undo) ---
    interface ActionRecord {
        type: 'move' | 'archive' | 'rename';
        itemId: string;
        undo: () => Promise<void>;
        description: string;
    }
    const [history, setHistory] = useState<ActionRecord[]>([]);

    const pushHistory = (action: ActionRecord) => {
        setHistory(prev => [...prev.slice(-19), action]); // Keep last 20 actions
    };

    const undo = async () => {
        if (history.length === 0) return;
        const lastAction = history[history.length - 1];
        setHistory(prev => prev.slice(0, -1));

        console.log('[ViewModel] Undoing:', lastAction.description);
        try {
            await lastAction.undo();
            await refresh(); // Refresh UI after undo
        } catch (e) {
            console.error('[ViewModel] Undo failed', e);
        }
    };

    // --- Actions with History ---

    const throwIn = async (title: string) => {
        if (!title.trim()) return;
        await JBWOSRepository.addItemToInbox(title);
        await refresh();
        // ThrowIn undo is technically "Delete", but we might skip tracking creation for now or add later.
    };

    const moveToReady = async (id: string) => {
        const item = [...inboxItems, ...scheduledItems, ...waitingItems, ...readyItems, ...executionItems, ...pendingItems, ...doneItems].find(i => i.id === id);
        const originalStatus = item?.status || 'inbox'; // Fallback

        const currentReadyItems = await JBWOSRepository.getItemsByStatus('ready');
        if (currentReadyItems.length >= 2) throw new Error("今日はもう手一杯です（最大2件まで）");

        await JBWOSRepository.updateStatus(id, 'ready');
        pushHistory({
            type: 'move',
            itemId: id,
            undo: async () => JBWOSRepository.updateStatus(id, originalStatus),
            description: `Move ${id} to Ready`
        });
        await refresh();
    };

    const moveToScheduled = async (id: string) => {
        const item = [...inboxItems, ...scheduledItems, ...waitingItems, ...readyItems, ...executionItems, ...pendingItems, ...doneItems].find(i => i.id === id);
        const originalStatus = item?.status || 'inbox';

        await JBWOSRepository.updateStatus(id, 'scheduled');
        pushHistory({
            type: 'move',
            itemId: id,
            undo: async () => JBWOSRepository.updateStatus(id, originalStatus),
            description: `Move ${id} to Scheduled`
        });
        await refresh();
    };

    const moveToExecution = async (id: string) => {
        const item = [...inboxItems, ...scheduledItems, ...waitingItems, ...readyItems, ...executionItems, ...pendingItems, ...doneItems].find(i => i.id === id);
        const originalStatus = item?.status || 'inbox';

        await JBWOSRepository.updateStatus(id, 'execution');
        pushHistory({
            type: 'move',
            itemId: id,
            undo: async () => JBWOSRepository.updateStatus(id, originalStatus),
            description: `Move ${id} to Execution`
        });
        await refresh();
    };

    const moveToWaiting = async (id: string, _reason: string) => {
        const item = [...inboxItems, ...scheduledItems, ...waitingItems, ...readyItems, ...executionItems, ...pendingItems, ...doneItems].find(i => i.id === id);
        const originalStatus = item?.status || 'inbox';

        await JBWOSRepository.updateStatus(id, 'waiting');
        pushHistory({
            type: 'move',
            itemId: id,
            undo: async () => JBWOSRepository.updateStatus(id, originalStatus),
            description: `Move ${id} to Waiting`
        });
        await refresh();
    };

    const moveToPending = async (id: string) => {
        const item = [...inboxItems, ...scheduledItems, ...waitingItems, ...readyItems, ...executionItems, ...pendingItems, ...doneItems].find(i => i.id === id);
        const originalStatus = item?.status || 'inbox';

        await JBWOSRepository.updateStatus(id, 'pending');
        pushHistory({
            type: 'move',
            itemId: id,
            undo: async () => JBWOSRepository.updateStatus(id, originalStatus),
            description: `Move ${id} to Pending`
        });
        await refresh();
    };

    const updateItemTitle = async (id: string, title: string) => {
        if (!title.trim()) return;
        const item = [...inboxItems, ...scheduledItems, ...waitingItems, ...readyItems, ...executionItems, ...pendingItems, ...doneItems].find(i => i.id === id);
        const originalTitle = item?.title || '';

        await JBWOSRepository.updateTitle(id, title);
        pushHistory({
            type: 'rename',
            itemId: id,
            undo: async () => JBWOSRepository.updateTitle(id, originalTitle),
            description: `Rename ${id}`
        });
        await refresh();
    };

    const moveToInbox = async (id: string) => {
        const item = [...inboxItems, ...scheduledItems, ...waitingItems, ...readyItems, ...executionItems, ...pendingItems, ...doneItems].find(i => i.id === id);
        const originalStatus = item?.status || 'inbox';

        await JBWOSRepository.updateStatus(id, 'inbox');
        pushHistory({
            type: 'move',
            itemId: id,
            undo: async () => JBWOSRepository.updateStatus(id, originalStatus),
            description: `Move ${id} to Inbox`
        });
        await refresh();
    };

    const markAsDone = async (id: string) => {
        const item = [...inboxItems, ...scheduledItems, ...waitingItems, ...readyItems, ...executionItems, ...pendingItems, ...doneItems].find(i => i.id === id);
        const originalStatus = item?.status || 'inbox';

        await JBWOSRepository.updateStatus(id, 'done');
        pushHistory({
            type: 'move',
            itemId: id,
            undo: async () => JBWOSRepository.updateStatus(id, originalStatus),
            description: `Mark ${id} as Done`
        });
        await refresh();
    };

    const archiveItem = async (id: string) => {
        const item = [...inboxItems, ...scheduledItems, ...waitingItems, ...readyItems, ...executionItems, ...pendingItems, ...doneItems].find(i => i.id === id);
        const originalStatus = item?.status || 'inbox';

        await JBWOSRepository.archiveItem(id);
        pushHistory({
            type: 'archive',
            itemId: id,
            undo: async () => JBWOSRepository.updateStatus(id, originalStatus),
            description: `Archive ${id}`
        });
        await refresh();
    };

    const triggerInterrupt = async (title: string) => {
        await JBWOSRepository.addItemToInbox(title);
        // Find and mark as interrupt
        const items = await JBWOSRepository.getItemsByStatus('inbox');
        const newItem = items.find(i => i.title === title);
        if (newItem) {
            await JBWOSRepository.markAsInterrupt(newItem.id as string);
        }
        await refresh();
    };

    return {
        inboxItems,
        scheduledItems,
        waitingItems,
        readyItems,
        executionItems,
        pendingItems,
        doneItems,
        refresh,
        throwIn,
        moveToInbox,
        moveToWaiting,
        moveToReady,
        moveToScheduled,
        moveToExecution,
        moveToPending,
        markAsDone,
        updateItemTitle,
        triggerInterrupt,
        archiveItem, // Renamed from deleteItem
        undo, // [NEW]
        canUndo: history.length > 0, // [NEW]
        isReadyFull: readyItems.length >= 2
    };
};
