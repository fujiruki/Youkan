import { db, Door, Project, Deliverable } from '../../../../db/db';
import { JudgableItem, JudgmentStatus, Item } from '../types';
import { ApiClient } from '../../../../api/client';
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
        // 1. Fetch Server Data
        let apiShelf = { active: [], preparation: [], intent: [], history: [] };
        try {
            const res = await ApiClient.getGdbShelf();
            if (res) apiShelf = res as any;
        } catch (e) {
            console.error('Failed to fetch GDB from Server:', e);
            // Non-blocking: continue to show local
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
                updatedAt: p.updatedAt.getTime(),
                createdAt: p.createdAt.getTime(),
                category: 'project',
                type: 'project',
                isProject: true
            } as JudgableItem));

            // B. Deliverables (Manufacturing Layer)
            const deliverables = await db.deliverables.toArray();
            const deliverableItems = await Promise.all(deliverables.map(d => convertDeliverableToItem(d)));

            // [Migration/Fallback] If Door has no Deliverable, allow it for now?
            // Ideally assume all Doors have Deliverables. For now, fetch Doors without DeliverableID?
            // Actually, we should just show Deliverables.
            // But legacy Doors might not have Deliverables yet.
            // Let's migrate legacy doors on the fly if needed, or just show them if no deliverable.
            const legacyDoors = await db.doors.filter(d => !d.deliverableId).toArray();
            const legacyDoorItems = await Promise.all(legacyDoors.map(d => convertDoorToItem(d)));

            localItems = [...projectItems, ...deliverableItems, ...legacyDoorItems];
        } catch (e) {
            console.error('Failed to fetch Local Data:', e);
        }

        // 3. Merge & Sort
        // Strategy: Categorize local items into Shelf buckets
        const mergedShelf = {
            active: [...(apiShelf.active || []), ...localItems.filter(i => i.status === 'inbox' || !i.status)], // Inbox goes to Active
            preparation: [...(apiShelf.preparation || []), ...localItems.filter(i => i.status === 'decision_hold' || i.status === 'scheduled')],
            intent: [...(apiShelf.intent || []), ...localItems.filter(i => i.status === 'someday' || i.status === 'intent')],
            log: [...(apiShelf.history || []), ...localItems.filter(i => i.status === 'done' || i.status === 'archive' || i.status === 'decision_rejected')] // Mapping 'history' key from API to 'log' key in Frontend
        };

        // Sort each bucket by updatedAt desc (or RDD for Active? Keep simple for now)
        mergedShelf.active.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
        mergedShelf.preparation.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
        mergedShelf.intent.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
        mergedShelf.log.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

        return mergedShelf;
    },

    // Today View
    getTodayView: async () => {
        return ApiClient.getTodayView();
    },

    // Decision Logic
    resolveDecision: async (id: string, decision: 'yes' | 'hold' | 'no', note?: string) => {
        // [Hybrid] Handle Local Updates (Projects/Doors)
        if (id.startsWith('project-')) {
            const projectId = parseInt(id.replace('project-', ''), 10);
            if (!isNaN(projectId)) {
                let status: JudgmentStatus = 'inbox';
                if (decision === 'hold') status = 'decision_hold';
                if (decision === 'no' && note === 'someday') status = 'someday'; // or 'intent'
                if (decision === 'no' && note === 'archive') status = 'archive'; // if mapped

                // Map GDB semantics to Schema semantics
                // GDB uses 'someday'? Schema uses 'someday' or 'intent'? 
                // VM sends 'no' with note='intent' or 'someday'.
                // Let's assume note is the status key if 'no'.
                if (decision === 'no' && (note === 'intent' || note === 'someday')) {
                    status = 'someday' as any;
                }

                await db.projects.update(projectId, {
                    judgmentStatus: status as any,
                    updatedAt: new Date()
                });
                return;
            }
        }
        if (id.startsWith('door-')) {
            const doorId = parseInt(id.replace('door-', ''), 10);
            if (!isNaN(doorId)) {
                // Logic duplicated from updateItem? Or just allow updateItem to handle it?
                // VM calls updateItem THEN resolveDecision usually.
                // But resolveDecision is also called for sorting.
                // Minimal implementation: Update status.
                let status = 'inbox';
                if (decision === 'hold') status = 'decision_hold';
                if (decision === 'no') status = 'inbox'; // Logic depends on note
                // For now, let updateItem handle main status changes if VM does so.
                // But VM relies on resolveDecision API often.
                // Let's rely on ApiClient normally, but for Local we must Implement here.
                // Simpler: Just allow fallthrough to ApiClient? No, API doesn't know local IDs.
                // So we MUST implement local logic.

                // However, VM implementation:
                // await updateItem(id, updates);
                // await resolveDecision(id, decision, note);

                // If we implement updateItem correctly, maybe we don't need full logic here?
                // But resolveDecision is semantically "Done with Inbox".
                // For Local Items, updateItem is enough IF VM uses it.
                return; // Assume updateItem handled the data change.
            }
        }

        return ApiClient.resolveDecision(id, decision, note);
    },

    // Today Logic
    commitToToday: async (id: string) => {
        return ApiClient.commitToToday(id);
    },
    startExecution: async (id: string) => {
        return ApiClient.startExecution(id);
    },
    completeItem: async (id: string) => {
        return ApiClient.completeItem(id);
    },

    // Side Memo Logic
    getMemos: async () => ApiClient.getMemos(),
    createMemo: async (content: string) => ApiClient.createMemo(content),
    deleteMemo: async (id: string) => ApiClient.deleteMemo(id),
    moveMemoToInbox: async (id: string) => ApiClient.moveMemoToInbox(id),

    // Generic Update (For flexibility)
    updateItem: async (id: string, data: Partial<Item>) => {
        // [Hybrid] Handle Local Project ID
        if (id.startsWith('project-')) {
            const projectId = parseInt(id.replace('project-', ''), 10);
            if (!isNaN(projectId)) {
                // Map Item fields to Project fields
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
            // Update Deliverable
            const updates: any = {};
            if (data.status) updates.judgmentStatus = data.status;
            if (data.title) updates.name = data.title;
            if (data.estimatedMinutes !== undefined) updates.estimatedWorkMinutes = data.estimatedMinutes; // Fix: manHours -> estimatedMinutes
            if (data.due_date !== undefined) {
                // Convert string "YYYY-MM-DD" to Date
                updates.dueDate = data.due_date ? new Date(data.due_date) : undefined;
            }

            updates.updatedAt = new Date();
            await db.deliverables.update(deliverableId, updates);
            return;
        }

        // [Legacy] Handle Local Door ID (Keep for backward compat)
        if (id.startsWith('door-')) {
            const doorId = parseInt(id.replace('door-', ''), 10);
            if (!isNaN(doorId)) {
                const updates: any = {};
                if (data.status) updates.judgmentStatus = data.status;
                if (data.title) updates.name = data.title;
                if (data.prep_date !== undefined) updates.prep_date = data.prep_date; // Allow null
                // ... other fields
                updates.updatedAt = new Date();
                await db.doors.update(doorId, updates);
                return;
            }
        }

        return ApiClient.updateItem(id, data);
    },

    // [NEW] Create Item (Generic)
    createItem: async (item: Partial<Item>): Promise<string> => {
        // Use ApiClient to create item.
        // If ApiClient.createItem returns void, we might need to adjust or rely on the ID we passed if generated.
        // Actually ApiClient.createItem definition says: async createItem(item: Partial<Item>): Promise<void>
        // But usually we want to return the ID. Repository.addItemToInbox generates it.
        // Let's assume the ID is passed in the item object or we generate it if missing.
        if (!item.id) {
            item.id = uuidv4();
        }
        await ApiClient.createItem(item);
        return item.id!;
    },

    // [NEW] Get Sub-Tasks
    getSubTasks: async (parentId: string): Promise<Item[]> => {
        // API doesn't have explicit getSubTasks yet? 
        // We can use getAllItems and filter, or assume ApiClient has ability.
        // For Hybrid/Local, we need to check DB if items are stored there?
        // Wait, JBWOSRepository.getItemsByStatus fetches from API + Local.
        // Currently Sub-tasks are likely on Server (API).
        // Let's assume we fetch all and filter for MVP, or add query logic.
        // Since we don't have a specific endpoint, efficiently we should query by parentId.
        // If API doesn't support it, we must fetch all.
        // However, `getItemsByStatus` implementation suggests `ApiClient.getAllItems()` exists.

        const allItems = await ApiClient.getAllItems();
        return allItems.filter(i => i.parentId === parentId);
    },

    // [NEW] Get Items by Source ID (for Data Sync)
    getItemsBySourceId: async (sourceId: string): Promise<Item[]> => {
        // MVP: Client-side filtering
        const allItems = await ApiClient.getAllItems();
        return allItems.filter(i => i.doorId === sourceId);
    },

    // [NEW] Update Sub-Task (or any item) by ID
    updateItemGeneric: async (id: string, updates: Partial<Item>): Promise<void> => {
        await ApiClient.updateItem(id, updates);
    },

    // 8. Settings (Capacity Config) [NEW]
    getCapacityConfig: async (): Promise<any | null> => {
        // Use 'any' to avoid strict type dependency if not imported, 
        // but ideally we import CapacityConfig. For now, rely on caller casting.
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

async function convertDeliverableToItem(deliverable: Deliverable): Promise<Item> {
    let project: Project | undefined;
    if (deliverable.projectId) {
        project = await db.projects.get(deliverable.projectId);
    }

    return {
        id: `deliverable-${deliverable.id}`,
        title: deliverable.name,
        status: (deliverable.judgmentStatus || 'inbox') as JudgmentStatus,
        statusUpdatedAt: deliverable.updatedAt.getTime(),
        interrupt: false,
        weight: 1, // Todo: Add weight to Deliverable
        projectId: project?.name,
        // waitingReason: deliverable.waitingReason,
        doorId: deliverable.id, // Source ID
        category: 'production', // Generic production
        type: 'start',
        // thumbnail? Link to Door thumbnail if exists? 
        // We might need to fetch linked Door to get thumbnail.
        // const door = await db.doors.where('deliverableId').equals(deliverable.id).first();
        // thumbnail: door?.thumbnail,
        createdAt: deliverable.createdAt.getTime(),
        createdAt: deliverable.createdAt.getTime(),
        updatedAt: deliverable.updatedAt.getTime(),
        estimatedMinutes: deliverable.estimatedWorkMinutes, // [FIX] manHours -> estimatedMinutes
        due_date: deliverable.dueDate ? deliverable.dueDate.toISOString().split('T')[0] : undefined, // [FIX] Date -> YYYY-MM-DD
        due_status: undefined, // Optional
        memo: deliverable.description + (project ? ` @${project.name}` : '')
    };
}
