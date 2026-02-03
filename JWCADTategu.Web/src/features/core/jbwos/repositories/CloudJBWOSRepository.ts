import { ApiClient } from '../../../../api/client';
import { JudgableItem, JudgmentStatus, GdbShelf } from '../types';

// Cloud-First Repository Implementation
// Uses Unified Backend API (/api/items)

export const CloudJBWOSRepository = {

    // 1. Fetch all items (Aggregated)
    getAllItems: async (): Promise<JudgableItem[]> => {
        try {
            // Use Aggregated Scope to get Personal + Company items
            return await ApiClient.getAllItems({ scope: 'aggregated' });
        } catch (e) {
            console.error('CloudRepo: Fetch Failed', e);
            throw e;
        }
    },

    // 2. Fetch by Status (Filtering on client side for now, or could use API filter)
    getItemsByStatus: async (status: JudgmentStatus): Promise<JudgableItem[]> => {
        try {
            const allItems = await ApiClient.getAllItems({ scope: 'aggregated' });
            return allItems
                .filter(i => i.status === status)
                .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
        } catch (e) {
            console.error('CloudRepo: Fetch Failed', e);
            throw e;
        }
    },

    // 3. Add Item (Inbox)
    addItemToInbox: async (title: string, tenantId?: string | null, projectId?: string | null): Promise<string> => {
        const res = await ApiClient.createItem({ title, status: 'inbox', tenantId, projectId });
        return res.id;
    },

    // 4. Update Status
    updateStatus: async (id: string, status: JudgmentStatus): Promise<void> => {
        await ApiClient.updateItem(id, { status });
    },

    // 5. GDB Shelf (Aggregated View)
    getGdbShelf: async (projectId?: string): Promise<GdbShelf> => {
        // [FIX] If projectId is provided, do NOT use 'dashboard' scope.
        // Dashboard scope filters items assigned to ME.
        // Project scope should return ALL items in that project.
        const scope = projectId ? undefined : 'dashboard';
        const allItems = await ApiClient.getAllItems({ scope, project_id: projectId });

        // Categorize based on JBWOS Logic
        return {
            // [FIX] Include 'focus' items in active list to prevent disappearance from GDB views if not in Today View
            active: allItems.filter(i => i.status === 'inbox' || i.status === 'focus'),
            preparation: allItems.filter(i => i.status === 'waiting'),
            intent: allItems.filter(i => i.status === 'pending'),
            log: allItems.filter(i => i.status === 'done')
        };
    },

    // 6. Today View
    getTodayView: async (projectId?: string): Promise<{ commits: JudgableItem[]; candidates: JudgableItem[]; execution: JudgableItem | null }> => {
        try {
            const res = await ApiClient.getTodayView(projectId);

            return {
                commits: res.commits || [],
                candidates: res.candidates || [],
                execution: res.execution || null
            };
        } catch (e) {
            console.error('CloudRepo: GetTodayView Failed', e);
            return { commits: [], candidates: [], execution: null };
        }
    },

    // Standard Operations
    updateTitle: async (id: string, title: string) => {
        await ApiClient.updateItem(id, { title });
    },

    markAsInterrupt: async (id: string, isInterrupt: boolean) => {
        await ApiClient.updateItem(id, { interrupt: isInterrupt });
    },

    deleteItem: async (id: string) => {
        await ApiClient.deleteItem(id);
    },

    archiveItem: async (id: string) => {
        await ApiClient.archiveItem(id);
    },

    trashItem: async (id: string) => {
        await ApiClient.trashItem(id);
    },

    restoreItem: async (id: string) => {
        await ApiClient.restoreItem(id);
    },

    destroyItem: async (id: string) => {
        await ApiClient.destroyItem(id);
    },

    getArchivedItems: async (projectId?: string) => {
        return await ApiClient.getAllItems({ project_id: projectId, show_archived: true });
    },

    getTrashedItems: async (projectId?: string) => {
        return await ApiClient.getAllItems({ project_id: projectId, show_trash: true });
    },



    // Decisions
    resolveDecision: async (id: string, decision: 'yes' | 'hold' | 'no', note?: string, rdd?: number) => {
        await ApiClient.resolveDecision(id, decision, note, rdd);
    },

    // Execution
    commitToToday: async (id: string) => {
        await ApiClient.commitToToday(id);
    },

    startExecution: async (id: string) => {
        await ApiClient.startExecution(id);
    },

    completeItem: async (id: string) => {
        await ApiClient.completeItem(id);
    },

    // Memos
    getMemos: async () => ApiClient.getMemos(),

    createMemo: async (content: string) => ApiClient.createMemo(content),

    deleteMemo: async (id: string) => ApiClient.deleteMemo(id),

    moveMemoToInbox: async (id: string) => ApiClient.moveMemoToInbox(id),

    // Generic Update
    updateItem: async (id: string, updates: Partial<JudgableItem>) => {
        await ApiClient.updateItem(id, updates);
    },

    createItem: async (item: Partial<JudgableItem>) => {
        const res = await ApiClient.createItem(item);
        return res.id;
    },

    // Subtasks
    getSubTasks: async (parentId: string): Promise<JudgableItem[]> => {
        return await ApiClient.getAllItems({ parentId });
    },

    getMembers: async () => {
        return await ApiClient.getMembers();
    },

    // Factory
    getItemsBySourceId: async (_sourceId: string) => {
        return [];
    },

    updateItemGeneric: async (id: string, updates: any) => {
        await ApiClient.updateItem(id, updates);
    },

    getCapacityConfig: async () => {
        return { defaultDailyMinutes: 480, holidays: [], exceptions: {} };
    },

    getProjects: async (scope?: 'personal' | 'company' | 'dashboard' | 'aggregated'): Promise<JudgableItem[]> => {
        const projects = await ApiClient.getProjects({ scope });
        // [REFINE] Unify title/name
        return (projects || []).map(p => ({
            ...p,
            title: p.title || p.name,
        }));
    },

    getJoinedTenants: async (): Promise<{ id: string; name: string; role: string }[]> => {
        return await ApiClient.getJoinedTenants();
    },

    saveCapacityConfig: async (_config: any) => {
        // TODO
    }
};
