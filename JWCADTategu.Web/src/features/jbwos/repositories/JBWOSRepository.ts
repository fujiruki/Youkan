import { db, Door, Project } from '../../../db/db';
import { JudgableItem, JudgmentStatus, Item } from '../types';
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
    addItemToInbox: async (title: string): Promise<string> => {
        // ID generation handles by Server or Client? Client UUID is safer for offline-first future.
        const id = uuidv4();
        const newItem: Partial<JudgableItem> = {
            id,
            title,
            status: 'inbox'
        };
        await ApiClient.createItem(newItem);
        return id;
    },

    // 3. Update Status
    updateStatus: async (id: string, status: JudgmentStatus): Promise<void> => {
        // [Hybrid] Handle Virtual Door ID
        if (id.startsWith('door-')) {
            const doorId = parseInt(id.replace('door-', ''), 10);
            if (!isNaN(doorId)) {
                await db.doors.update(doorId, {
                    judgmentStatus: status as any,
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

    // 6. Delete (Hard Delete or Archive?)
    // Request is "Delete", let's use Archive for safety but rename wrapper to deleteItem to match User intent in VM.
    deleteItem: async (id: string): Promise<void> => {
        if (id.startsWith('door-')) {
            const doorId = parseInt(id.replace('door-', ''), 10);
            if (!isNaN(doorId)) {
                await db.doors.delete(doorId); // Local: Hard Delete
                return;
            }
        }
        // API: Call delete endpoint if exists, or use destroy logic
        // For MVP 3.1, let's assume we want to remove it.
        await ApiClient.deleteItem(id);
    },

    // 7. Archive (Logical Delete - Keep for reference)
    archiveItem: async (id: string): Promise<void> => {
        if (id.startsWith('door-')) {
            const doorId = parseInt(id.replace('door-', ''), 10);
            if (!isNaN(doorId)) {
                await db.doors.update(doorId, {
                    judgmentStatus: 'archive' as any,
                    updatedAt: new Date()
                });
                return;
            }
        }
        // API Logical Delete (Update status)
        await ApiClient.updateItem(id, { status: 'archive' });
    },

    // --- Phase 2: Backend Intelligence Methods ---

    // GDB Shelf View
    getGdbShelf: async () => {
        return ApiClient.getGdbShelf();
    },

    // Today View
    getTodayView: async () => {
        return ApiClient.getTodayView();
    },

    // Decision Logic
    resolveDecision: async (id: string, decision: 'yes' | 'hold' | 'no', note?: string) => {
        return ApiClient.resolveDecision(id, decision, note);
    },

    // Today Logic
    commitToToday: async (id: string) => {
        return ApiClient.commitToToday(id);
    },
    completeItem: async (id: string) => {
        return ApiClient.completeItem(id);
    },

    // Side Memo Logic
    getMemos: async () => ApiClient.getMemos(),
    createMemo: async (content: string) => ApiClient.createMemo(content),
    deleteMemo: async (id: string) => ApiClient.deleteMemo(id),
    moveMemoToInbox: async (id: string) => ApiClient.moveMemoToInbox(id),
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
