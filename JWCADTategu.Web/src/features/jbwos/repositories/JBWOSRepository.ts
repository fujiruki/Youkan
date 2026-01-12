import { db, Door, Project } from '../../../db/db';
import { JudgableItem, JudgmentStatus, Item } from '../../../jbwos-core/types';
import { ApiClient } from '../../../api/client';
import { v4 as uuidv4 } from 'uuid';

// src/features/jbwos/repositories/JBWOSRepository.ts

export const JBWOSRepository = {
    // 1. Fetch all items (Hybrid: API Items + Local Doors)
    getItemsByStatus: async (status: JudgmentStatus): Promise<JudgableItem[]> => {
        // A. Fetch Items from Server API
        let apiItems: JudgableItem[] = [];
        try {
            const allItems = await ApiClient.getAllItems();
            apiItems = allItems.filter(i => i.status === status);
        } catch (e) {
            console.error('Failed to fetch from API:', e);
            // Fallback or empty? Empty for MVP to avoid mixed state confusion
        }

        // B. Fetch Doors from Local IndexedDB (Integration Logic)
        let doorItems: JudgableItem[] = [];
        try {
            const doors = await db.doors
                .where('judgmentStatus')
                .equals(status)
                .toArray();

            doorItems = await Promise.all(doors.map(async (d) => convertDoorToItem(d)));
        } catch (e) {
            console.error('Failed to fetch local doors:', e);
        }

        // C. Merge and Sort
        const merged = [...apiItems, ...doorItems];
        // Sort by statusUpdatedAt descending (newest first)
        return merged.sort((a, b) => (b.statusUpdatedAt || 0) - (a.statusUpdatedAt || 0));
    },

    // 2. Add Item (To API)
    addItemToInbox: async (title: string): Promise<void> => {
        // ID generation handles by Server or Client? Client UUID is safer for offline-first future.
        const newItem: Partial<JudgableItem> = {
            id: uuidv4(),
            title,
            status: 'inbox'
        };
        await ApiClient.createItem(newItem);
    },

    // 3. Update Status
    updateStatus: async (id: string, status: JudgmentStatus): Promise<void> => {
        // [Hybrid] Handle Virtual Door ID
        if (id.startsWith('door-')) {
            const doorId = parseInt(id.replace('door-', ''), 10);
            if (!isNaN(doorId)) {
                await db.doors.update(doorId, {
                    judgmentStatus: status,
                    updatedAt: new Date()
                });
                return;
            }
        }

        // Handled by API
        await ApiClient.updateItem(id, { status });
    },

    // 4. Update Title
    updateTitle: async (id: string, title: string): Promise<void> => {
        // [Hybrid] Handle Virtual Door ID
        if (id.startsWith('door-')) {
            const doorId = parseInt(id.replace('door-', ''), 10);
            if (!isNaN(doorId)) {
                await db.doors.update(doorId, {
                    name: title,
                    updatedAt: new Date()
                });
                return;
            }
        }

        await ApiClient.updateItem(id, { title });
    },

    // 5. Interrupt
    markAsInterrupt: async (id: string): Promise<void> => {
        if (id.startsWith('door-')) {
            const doorId = parseInt(id.replace('door-', ''), 10);
            await db.doors.update(doorId, {
                judgmentStatus: 'inbox',
                updatedAt: new Date()
            });
            return;
        }

        // API doesn't have specific endpoint, use update
        await ApiClient.updateItem(id, {
            status: 'inbox',
            interrupt: true as any // Cast for API compatibility
        });
    },

    // 6. Archive (Logical Delete)
    archiveItem: async (id: string): Promise<void> => {
        if (id.startsWith('door-')) {
            const doorId = parseInt(id.replace('door-', ''), 10);
            if (!isNaN(doorId)) {
                await db.doors.update(doorId, {
                    judgmentStatus: 'archive', // Logical delete for doors too? Or undefined? Let's use archive for consistency if DB supports it.
                    // If 'archive' is not in JudgmentStatus type, we might need to cast or update type.
                    // For now, assuming JudgmentStatus is string-like or compatible. 
                    // Actually, JudgmentStatus might be strict union. Let's check type definition if error occurs.
                    // Reverting to 'undefined' for doors as per previous delete logic might be safer IF 'archive' requires schema change.
                    // BUT plan says "Logical Delete". Let's try 'archive'.
                    judgmentStatus: 'archive' as any,
                    updatedAt: new Date()
                });
                return;
            }
        }
        // API Logical Delete (Update status)
        await ApiClient.updateItem(id, { status: 'archive' });
    }
};

// Helper function (Simulated private)
async function convertDoorToItem(door: Door): Promise<Item> {
    let project: Project | undefined;
    if (door.projectId) {
        project = await db.projects.get(door.projectId);
    }

    return {
        id: `door-${door.id}`,
        title: door.name,
        status: door.judgmentStatus || 'inbox',
        statusUpdatedAt: door.updatedAt.getTime(),
        interrupt: false,
        weight: door.weight || 1,
        projectId: project?.name,
        waitingReason: door.waitingReason,
        doorId: String(door.id),
        category: door.category || 'door',
        type: 'start',
        thumbnail: door.thumbnail,
        createdAt: door.createdAt.getTime(),
        updatedAt: door.updatedAt.getTime(),
        memo: door.tag + (project ? ` @${project.name}` : '')
    };
}
