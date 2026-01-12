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

    const throwIn = async (title: string) => {
        if (!title.trim()) return;
        await JBWOSRepository.addItemToInbox(title);
        await refresh();
    };

    const moveToReady = async (id: string) => {
        const currentReadyItems = await JBWOSRepository.getItemsByStatus('ready');
        console.log('[ViewModel] moveToReady check:', currentReadyItems.length);
        if (currentReadyItems.length >= 2) {
            console.warn('[ViewModel] Ready limit reached. Throwing error.');
            throw new Error("今日はもう手一杯です（最大2件まで）");
        }
        await JBWOSRepository.updateStatus(id, 'ready');
        await refresh();
    };

    const moveToScheduled = async (id: string) => {
        await JBWOSRepository.updateStatus(id, 'scheduled');
        await refresh();
    };

    const moveToExecution = async (id: string) => {
        await JBWOSRepository.updateStatus(id, 'execution');
        await refresh();
    };

    const moveToWaiting = async (id: string, _reason: string) => {
        // Reason ignored for MVP status update
        await JBWOSRepository.updateStatus(id, 'waiting');
        await refresh();
    };

    const moveToPending = async (id: string) => {
        await JBWOSRepository.updateStatus(id, 'pending');
        await refresh();
    };

    const updateItemTitle = async (id: string, title: string) => {
        if (!title.trim()) return;
        await JBWOSRepository.updateTitle(id, title);
        await refresh();
    };

    const moveToInbox = async (id: string) => {
        await JBWOSRepository.updateStatus(id, 'inbox');
        await refresh();
    };

    const markAsDone = async (id: string) => {
        await JBWOSRepository.updateStatus(id, 'done');
        await refresh();
    };

    const deleteItem = async (id: string) => {
        await JBWOSRepository.deleteItem(id);
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
        deleteItem,
        isReadyFull: readyItems.length >= 2
    };
};
