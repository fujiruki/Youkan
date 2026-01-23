import { db, Door, Project } from '../../../../db/db';
import { JudgableItem, JudgmentStatus, Item } from '../types';
import { Deliverable } from '../../../../features/plugins/manufacturing/types';
import { ApiClient } from '../../../../api/client';
import { v4 as uuidv4 } from 'uuid';

// src/features/jbwos/repositories/JBWOSRepository.ts

export const JBWOSRepository = {
    // Helper check
    isDebug: () => localStorage.getItem('jbwos_token') === 'mock-debug-token',

    // 1. Fetch all items (Hybrid: API Items + Local Doors)
    getItemsByStatus: async (status: JudgmentStatus): Promise<JudgableItem[]> => {
        // A. Fetch Items from Server API
        let apiItems: JudgableItem[] = [];
        if (!JBWOSRepository.isDebug()) {
            try {
                const allItems = await ApiClient.getAllItems();
                apiItems = allItems.filter(i => i.status === status);
            } catch (e) {
                console.error('Failed to fetch from API:', e);
            }
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
        return merged.sort((a, b) => (b.statusUpdatedAt || 0) - (a.statusUpdatedAt || 0));
    },

    // 2. Add Item (To API)
    addItemToInbox: async (title: string): Promise<string> => {
        const id = uuidv4();
        if (JBWOSRepository.isDebug()) return id;

        const newItem: Partial<JudgableItem> = {
            id,
            title,
            status: 'inbox'
        };

        try {
            await ApiClient.createItem(newItem);
        } catch (e) {
            console.warn('Failed to create Item via API:', e);
        }
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

        if (JBWOSRepository.isDebug()) return;

        // Handled by API
        try {
            await ApiClient.updateItem(id, { status });
        } catch (e) {
            console.warn('Failed to update status via API:', e);
        }
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

        if (JBWOSRepository.isDebug()) return;

        try {
            await ApiClient.updateItem(id, { title });
        } catch (e) {
            console.warn('Failed to update title via API:', e);
        }
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

        if (JBWOSRepository.isDebug()) return;

        try {
            await ApiClient.updateItem(id, {
                status: 'inbox',
                interrupt: true as any // Cast for API compatibility
            });
        } catch (e) {
            console.warn('Failed to markAsInterrupt via API:', e);
        }
    },

    // 6. Delete
    deleteItem: async (id: string): Promise<void> => {
        if (id.startsWith('door-')) {
            const doorId = parseInt(id.replace('door-', ''), 10);
            if (!isNaN(doorId)) {
                await db.doors.delete(doorId); // Local: Hard Delete
                return;
            }
        }

        if (JBWOSRepository.isDebug()) return;

        try {
            await ApiClient.deleteItem(id);
        } catch (e) {
            console.warn('Failed to deleteItem via API:', e);
        }
    },

    // 7. Archive
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

        if (JBWOSRepository.isDebug()) return;

        try {
            await ApiClient.updateItem(id, { status: 'archive' });
        } catch (e) {
            console.warn('Failed to archiveItem via API:', e);
        }
    },

    // --- Phase 2: Backend Intelligence Methods ---

    // GDB Shelf View
    getGdbShelf: async () => {
        // 1. Fetch Server Data
        let apiShelf = { active: [], preparation: [], intent: [], history: [] };
        if (!JBWOSRepository.isDebug()) {
            try {
                const res = await ApiClient.getGdbShelf();
                if (res) apiShelf = res as any;
            } catch (e) {
                console.warn('Failed to fetch GDB from Server:', e);
            }
        }

        // 2. Fetch Local Data (Projects & Doors)
        let localItems: JudgableItem[] = [];
        try {
            // A. Projects (Treat as Inbox/Active if not archived)
            const projects = await db.projects.filter(p => !p.isArchived).toArray();
            const projectItems = projects.map(p => ({
                id: `project-${p.id}`,
                title: `📁 ${p.name}`, // Add icon to distinguish
                status: (p.judgmentStatus || 'inbox') as JudgmentStatus, // [FIX] Use persisted status
                updatedAt: new Date(p.updatedAt).getTime(),
                createdAt: new Date(p.createdAt).getTime(),
                category: 'project',
                type: 'project',
                isProject: true
            } as JudgableItem));

            // B. Deliverables
            const deliverables = await db.deliverables.toArray();
            const deliverableItems = await Promise.all(deliverables.map(d => convertDeliverableToItem(d)));

            // [Migration/Fallback]
            const legacyDoors = await db.doors.filter(d => !d.deliverableId).toArray();
            const legacyDoorItems = await Promise.all(legacyDoors.map(d => convertDoorToItem(d)));

            localItems = [...projectItems, ...deliverableItems, ...legacyDoorItems];
        } catch (e) {
            console.error('Failed to fetch Local Data:', e);
        }

        // 3. Merge & Sort
        const mergedShelf = {
            active: [...(apiShelf.active || []), ...localItems.filter(i => i.status === 'inbox' || !i.status)],
            preparation: [...(apiShelf.preparation || []), ...localItems.filter(i => i.status === 'decision_hold' || i.status === 'scheduled')],
            intent: [...(apiShelf.intent || []), ...localItems.filter(i => (i.status as any) === 'someday' || (i.status as any) === 'intent')],
            log: [...(apiShelf.history || []), ...localItems.filter(i => i.status === 'done' || i.status === 'archive' || i.status === 'decision_rejected')]
        };

        const sortFn = (a: JudgableItem, b: JudgableItem) => (b.updatedAt || 0) - (a.updatedAt || 0);
        mergedShelf.active.sort(sortFn);
        mergedShelf.preparation.sort(sortFn);
        mergedShelf.intent.sort(sortFn);
        mergedShelf.log.sort(sortFn);

        return mergedShelf;
    },

    // Today View
    getTodayView: async () => {
        if (JBWOSRepository.isDebug()) {
            return { morning: [], afternoon: [], evening: [], candidates: [], commits: [], execution: null };
        }
        try {
            return await ApiClient.getTodayView();
        } catch (e) {
            console.warn('Failed to fetch Today View from API:', e);
            return { morning: [], afternoon: [], evening: [] };
        }
    },

    // Decision Logic
    resolveDecision: async (id: string, decision: 'yes' | 'hold' | 'no', note?: string) => {
        // [Hybrid] Handle Local Updates (Projects/Doors)
        if (id.startsWith('project-')) {
            const projectId = parseInt(id.replace('project-', ''), 10);
            if (!isNaN(projectId)) {
                let status: JudgmentStatus = 'inbox';
                if (decision === 'hold') status = 'decision_hold';
                if (decision === 'no' && note === 'someday') status = 'someday' as any;
                if (decision === 'no' && note === 'archive') status = 'archive';
                await db.projects.update(projectId, {
                    judgmentStatus: status as any,
                    updatedAt: new Date()
                });
                return;
            }
        }
        if (id.startsWith('door-')) return;

        if (JBWOSRepository.isDebug()) return;

        try {
            return await ApiClient.resolveDecision(id, decision, note);
        } catch (e) {
            console.warn('Failed to resolveDecision via API:', e);
        }
    },

    // Today Logic
    commitToToday: async (id: string) => {
        if (JBWOSRepository.isDebug()) return;
        try {
            return await ApiClient.commitToToday(id);
        } catch (e) { console.warn(e); }
    },
    startExecution: async (id: string) => {
        if (JBWOSRepository.isDebug()) return;
        try {
            return await ApiClient.startExecution(id);
        } catch (e) { console.warn(e); }
    },
    completeItem: async (id: string) => {
        if (JBWOSRepository.isDebug()) return;
        try {
            return await ApiClient.completeItem(id);
        } catch (e) { console.warn(e); }
    },

    // Side Memo Logic
    getMemos: async () => {
        if (JBWOSRepository.isDebug()) return [];
        try {
            return await ApiClient.getMemos();
        } catch (e) {
            return [];
        }
    },
    createMemo: async (content: string) => {
        if (JBWOSRepository.isDebug()) return;
        try {
            return await ApiClient.createMemo(content);
        } catch (e) {
            console.warn('Failed to create Memo via API:', e);
        }
    },
    deleteMemo: async (id: string) => {
        if (JBWOSRepository.isDebug()) return;
        try {
            return await ApiClient.deleteMemo(id);
        } catch (e) {
            console.warn('Failed to delete Memo via API:', e);
        }
    },
    moveMemoToInbox: async (id: string) => {
        if (JBWOSRepository.isDebug()) return;
        try {
            return await ApiClient.moveMemoToInbox(id);
        } catch (e) {
            console.warn('Failed to move Memo via API:', e);
        }
    },

    // Generic Update (For flexibility)
    updateItem: async (id: string, data: Partial<Item>) => {
        // [Hybrid] Handle Local Project ID
        if (id.startsWith('project-')) {
            const projectId = parseInt(id.replace('project-', ''), 10);
            if (!isNaN(projectId)) {
                const updates: any = {};
                if (data.status) updates.judgmentStatus = data.status;
                if (data.title) updates.name = data.title;
                updates.updatedAt = new Date();
                await db.projects.update(projectId, updates);
                return;
            }
        }

        // [Hybrid] Handle Deliverable ID
        if (id.startsWith('deliverable-')) {
            const deliverableId = id.replace('deliverable-', '');
            const updates: any = {};
            if (data.status) updates.judgmentStatus = data.status;
            if (data.title) updates.name = data.title;
            if (data.estimatedMinutes !== undefined) updates.estimatedWorkMinutes = data.estimatedMinutes;
            updates.updatedAt = Date.now();
            await db.deliverables.update(deliverableId, updates);
            return;
        }

        // [Legacy] Handle Local Door ID
        if (id.startsWith('door-')) {
            const doorId = parseInt(id.replace('door-', ''), 10);
            if (!isNaN(doorId)) {
                const updates: any = {};
                if (data.status) updates.judgmentStatus = data.status;
                if (data.title) updates.name = data.title;
                if (data.prep_date !== undefined) updates.prep_date = data.prep_date;
                updates.updatedAt = new Date();
                await db.doors.update(doorId, updates);
                return;
            }
        }

        if (JBWOSRepository.isDebug()) return;

        try {
            return await ApiClient.updateItem(id, data);
        } catch (e) {
            console.warn('Failed to update Item via API:', e);
        }
    },

    createItem: async (item: Partial<Item>): Promise<string> => {
        if (!item.id) {
            item.id = uuidv4();
        }

        if (JBWOSRepository.isDebug()) return item.id!;

        try {
            await ApiClient.createItem(item);
        } catch (e) {
            console.warn('Failed to create Item via API:', e);
        }
        return item.id!;
    },

    getSubTasks: async (parentId: string): Promise<Item[]> => {
        if (JBWOSRepository.isDebug()) return [];
        try {
            const allItems = await ApiClient.getAllItems();
            return allItems.filter(i => i.parentId === parentId);
        } catch (e) {
            return [];
        }
    },

    getItemsBySourceId: async (sourceId: string): Promise<Item[]> => {
        if (JBWOSRepository.isDebug()) return [];
        try {
            const allItems = await ApiClient.getAllItems();
            return allItems.filter(i => i.doorId === sourceId);
        } catch (e) {
            return [];
        }
    },

    updateItemGeneric: async (id: string, updates: Partial<Item>): Promise<void> => {
        if (JBWOSRepository.isDebug()) return;
        try {
            await ApiClient.updateItem(id, updates);
        } catch (e) {
            console.warn('Failed to updateItemGeneric via API:', e);
        }
    },

    getCapacityConfig: async (): Promise<any | null> => {
        const record = await db.settings.get('capacity_config');
        return record ? record.value : null;
    },

    saveCapacityConfig: async (config: any): Promise<void> => {
        await db.settings.put({
            id: 'capacity_config',
            value: config,
            updatedAt: Date.now()
        });
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
        statusUpdatedAt: new Date(door.updatedAt).getTime(), // Robust conversion
        interrupt: false,
        weight: door.weight || 1,
        projectId: project?.name,
        waitingReason: door.waitingReason,
        doorId: String(door.id),
        category: door.category || 'door',
        type: 'start',
        thumbnail: door.thumbnail,
        createdAt: new Date(door.createdAt).getTime(), // Robust conversion
        updatedAt: new Date(door.updatedAt).getTime(), // Robust conversion
        memo: door.tag + (project ? ` @${project.name}` : '')
    };
}

async function convertDeliverableToItem(deliverable: Deliverable): Promise<Item> {
    let project: Project | undefined;
    if (deliverable.projectId) {
        project = await db.projects.get(deliverable.projectId);
    }

    // Deliverable timestamps are definitely numbers in Types, but robust check doesn't hurt.
    const createdAt = typeof deliverable.createdAt === 'number' ? deliverable.createdAt : new Date(deliverable.createdAt).getTime();
    const updatedAt = typeof deliverable.updatedAt === 'number' ? deliverable.updatedAt : new Date(deliverable.updatedAt).getTime();
    const statusUpdatedAt = deliverable.statusUpdatedAt
        ? (typeof deliverable.statusUpdatedAt === 'number' ? deliverable.statusUpdatedAt : new Date(deliverable.statusUpdatedAt).getTime())
        : updatedAt;

    return {
        id: `deliverable-${deliverable.id}`,
        title: deliverable.name,
        status: (deliverable.status || 'inbox') as JudgmentStatus,
        statusUpdatedAt: statusUpdatedAt,
        interrupt: false,
        weight: 1,
        projectId: project?.name,
        doorId: deliverable.id,
        category: 'production',
        type: 'start',
        createdAt: createdAt,
        updatedAt: updatedAt,
        estimatedMinutes: deliverable.estimatedWorkMinutes,
        due_date: undefined,
        due_status: undefined,
        memo: (deliverable.description || '') + (project ? ` @${project.name}` : '')
    };
}
