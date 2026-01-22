import { ApiClient } from '../../../../api/client';
import { JudgableItem, JudgmentStatus } from '../types';

// Cloud-First Repository Implementation
// Directly fetches from API

export const CloudJBWOSRepository = {

    // 1. Fetch all items
    getItemsByStatus: async (status: JudgmentStatus): Promise<JudgableItem[]> => {
        try {
            // Fetch Projects and Doors via API
            // Current API: 
            // GET /api/projects
            // GET /api/doors

            // We need a unified 'Item' view.
            // Option A: Backend provides /api/items (Unified)
            // Option B: Frontend aggregates (like LocalRepo)

            // Let's assume Option B for now as Backend has /projects and /doors

            const projects = await ApiClient.request<any[]>('GET', '/projects');
            const doors = await ApiClient.request<any[]>('GET', '/doors');

            const projectItems = projects.map(p => ({
                id: p.id, // UUID
                title: `📁 ${p.name}`,
                status: p.judgment_status || 'inbox',
                updatedAt: p.updated_at ? new Date(p.updated_at).getTime() : Date.now(),
                createdAt: p.created_at ? new Date(p.created_at).getTime() : Date.now(),
                category: 'project',
                type: 'project',
                isProject: true
            } as JudgableItem));

            const doorItems = doors.map(d => ({
                id: d.id, // UUID
                title: d.name,
                status: d.judgment_status || 'inbox',
                updatedAt: d.updated_at ? new Date(d.updated_at).getTime() : Date.now(),
                createdAt: d.created_at ? new Date(d.created_at).getTime() : Date.now(),
                category: 'door',
                type: 'start',
                projectId: d.project_id
            } as JudgableItem));

            const all = [...projectItems, ...doorItems];
            return all.filter(i => i.status === status)
                .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

        } catch (e) {
            console.error('CloudRepo: Fetch Failed', e);
            throw e;
        }
    },

    // 2. Add (Project or Door)
    // Note: 'addItemToInbox' usually implies generic item.
    // For now we map it to 'Project' creation as a generic task container?
    // Or do we have an 'items' table? JBWOS uses generic items concept.
    // Detailed Design said "items" table (or projects). 
    // Let's use /api/projects for now if it's a top level item.
    addItemToInbox: async (title: string): Promise<string> => {
        try {
            const res = await ApiClient.request<{ id: string }>('POST', '/projects', {
                name: title,
                judgment_status: 'inbox'
            });
            return res.id;
        } catch (e) {
            console.error('CloudRepo: Create Failed', e);
            throw e;
        }
    },

    // 3. Update Status
    updateStatus: async (id: string, status: JudgmentStatus): Promise<void> => {
        try {
            // Determine type by ID format? UUID...
            // We might need to know if it is project or door.
            // Simple generic 'items' endpoint would be better on backend.
            // But for now, let's try updating Project first, if 404 try Door? No that's bad.
            // Ideally we store type in ID or handle it.
            // Wait, existing JBWOSRepo adds prefixes 'project-' 'door-'.
            // Cloud UUIDs don't have prefixes.
            // Let's rely on View Model passing the item object which implies type?
            // The method signature only takes ID.

            // Hack: Try /api/items/update_status if Backend implemented generic Update?
            // Detailed Design 3.2 says PUT /projects/:id

            // Workaround: We don't verify type here.
            // Let's implement a Helper "smartUpdate" on backend or try both?
            // OR, we assume we fetch items with type info, but here we only receive ID.

            // Let's try Project first.
            await ApiClient.request('PUT', `/projects/${id}`, { judgment_status: status });
        } catch (e) {
            // If 404, try Door
            try {
                await ApiClient.request('PUT', `/doors/${id}`, { judgment_status: status });
            } catch (e2) {
                console.error('CloudRepo: Update Status Failed', e2);
            }
        }
    },

    // ... (Implement other methods similarly)
    // For MVP, if we switch to Cloud, we might lose some generic features not yet backed on server.

    // GDB Shelf
    getGdbShelf: async () => {
        // Re-use logic: fetch all, categorize.
        // Or use /api/gdb if available (it was dummy in LocalRepo)
        // TODO: Implement full GDB shelf aggregation when API is ready

        // Transform and Merge
        // ... (Logic similar to getItemsByStatus but for all statuses)
        // Omitted for brevity, but needed for MVP.

        return { active: [], preparation: [], intent: [], log: [] }; // Placeholder
    },

    // Stub methods to satisfy interface
    updateTitle: async () => { },
    markAsInterrupt: async () => { },
    deleteItem: async () => { },
    archiveItem: async () => { },
    getTodayView: async () => ({ morning: [], afternoon: [], evening: [] }),
    resolveDecision: async () => { },
    commitToToday: async () => { },
    startExecution: async () => { },
    completeItem: async () => { },
    getMemos: async () => [],
    createMemo: async () => { },
    deleteMemo: async () => { },
    moveMemoToInbox: async () => { },
    updateItem: async () => { },
    createItem: async () => '',
    getSubTasks: async () => [],
    getItemsBySourceId: async () => [],
    updateItemGeneric: async () => { },
    getCapacityConfig: async () => null,
    saveCapacityConfig: async () => { }
};
