import { useState, useCallback, useEffect } from 'react';
import { ApiClient } from '../../../../api/client';
import { Item } from '../types';

export const useSubtasks = (parentId: string, defaultProjectId?: string, defaultTenantId?: string) => {
    const [subtasks, setSubtasks] = useState<Item[]>([]);
    const [loading, setLoading] = useState(false);

    const loadSubtasks = useCallback(async () => {
        if (!parentId) return;
        // setLoading(true); // Silent load prevents flickering affecting UX too much
        try {
            // Fetch items where parentId matches
            // Note: getAllItems in ApiClient needs to support parentId filter if not already
            const items = await ApiClient.getAllItems({ parentId });
            // Client-side sort by order or created_at?
            // For now, sorting by createdAt desc (newest first) or asc? 
            // Usually subtasks are orderable. Let's sort by createdAt asc for now.
            const sorted = items.sort((a, b) => a.createdAt - b.createdAt);
            setSubtasks(sorted);
        } catch (e) {
            console.error('Failed to load subtasks', e);
        } finally {
            setLoading(false);
        }
    }, [parentId]);

    useEffect(() => {
        loadSubtasks();
    }, [loadSubtasks]);

    const addSubtask = async (title: string, initialData?: Partial<Item>) => {
        if (!title.trim() || !parentId) return;

        // Optimistic Update
        const tempId = 'temp-' + Date.now();
        const newItem: Partial<Item> = {
            id: tempId,
            title: title,
            status: 'inbox',
            parentId: parentId,
            projectId: defaultProjectId || null,
            tenantId: defaultTenantId || null,
            createdAt: Math.floor(Date.now() / 1000),
            updatedAt: Math.floor(Date.now() / 1000),
            ...initialData // Merge initial data (e.g., due_date)
        };

        setSubtasks(prev => [...prev, newItem as Item]);

        try {
            // Remove temp id before sending to backend to let it generate real UUID
            const { id: _unusedId, ...dataToSend } = newItem;
            await ApiClient.createItem(dataToSend);
            await loadSubtasks(); // Refresh to get real ID
        } catch (e) {
            console.error('Failed to create subtask', e);
            setSubtasks(prev => prev.filter(p => p.id !== tempId)); // Revert
        }
    };

    return {
        subtasks,
        loading,
        addSubtask,
        refresh: loadSubtasks
    };
};
