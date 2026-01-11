import { useState, useEffect, useCallback } from 'react';
import { JBWOSRepository } from '../repositories/JBWOSRepository';
import { Item, JudgmentStatus } from '../types';

export const useJBWOSViewModel = () => {
    // Repository instance (In a real app, use DI or Context)
    const [repository] = useState(() => new JBWOSRepository());

    const [inboxItems, setInboxItems] = useState<Item[]>([]);
    const [readyItems, setReadyItems] = useState<Item[]>([]);
    const [waitingItems, setWaitingItems] = useState<Item[]>([]);
    const [pendingItems, setPendingItems] = useState<Item[]>([]);
    const [doneItems, setDoneItems] = useState<Item[]>([]);

    const refresh = useCallback(async () => {
        const inbox = await repository.getItemsByStatus('inbox');
        const ready = await repository.getItemsByStatus('ready');
        const waiting = await repository.getItemsByStatus('waiting');
        const pending = await repository.getItemsByStatus('pending');
        const done = await repository.getItemsByStatus('done');

        setInboxItems(inbox);
        setReadyItems(ready);
        setWaitingItems(waiting);
        setPendingItems(pending);
        setDoneItems(done);
    }, [repository]);

    // Initial Load
    useEffect(() => {
        refresh();
    }, [refresh]);

    const throwIn = async (title: string) => {
        if (!title.trim()) return;
        await repository.addItemToInbox(title);
        await refresh();
    };

    const moveToReady = async (id: string) => {
        // Constraint: Ready Max 2
        if (readyItems.length >= 2) {
            throw new Error('Ready bucket is full. You can only focus on 2 items per day.');
        }
        await repository.updateStatus(id, 'ready');
        await refresh();
    };

    const moveToWaiting = async (id: string, reason: string) => {
        // Ideally update reason field too, but repository needs update
        // For MVP, just status change.
        await repository.updateStatus(id, 'waiting');
        await refresh();
    };

    const moveToPending = async (id: string) => {
        await repository.updateStatus(id, 'pending');
        await refresh();
    };

    const updateItemTitle = async (id: string, title: string) => {
        if (!title.trim()) return;
        await repository.updateTitle(id, title);
        await refresh();
    };

    const moveToInbox = async (id: string) => {
        await repository.updateStatus(id, 'inbox');
        await refresh();
    };

    const markAsDone = async (id: string) => {
        await repository.updateStatus(id, 'done');
        // Check for stopping event logic here if needed, or in UI
        await refresh();
    };

    const triggerInterrupt = async (title: string) => {
        await repository.addItemToInbox(title);
        // We need 'markAsInterrupt' but addItemToInbox adds new item.
        // If converting existing item to interrupt, use markAsInterrupt logic.
        // For "Trigger Interrupt Button" (New Task):
        const items = await repository.getItemsByStatus('inbox');
        const newItem = items.find(i => i.title === title); // Naive find
        if (newItem) {
            await repository.markAsInterrupt(newItem.id);
        }
        await refresh();
    };

    return {
        inboxItems,
        readyItems,
        waitingItems,
        pendingItems,
        doneItems,
        refresh,
        throwIn,
        moveToReady,
        moveToWaiting,
        moveToPending,
        moveToInbox,
        markAsDone,
        updateItemTitle,
        triggerInterrupt,
        isReadyFull: readyItems.length >= 2
    };
};
