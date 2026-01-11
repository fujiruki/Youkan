import { JudgmentAdapter, JudgableItem, JudgmentStatus } from '../../jbwos-core/types';
import { db, Door, Project } from '../../db/db';

export class TateguJBWOSAdapter implements JudgmentAdapter {

    // Cache for project names to avoid N+1 queries ideally, 
    // or we fetch all projects upfront.
    // For simplicity in client-side IndexedDB, we can just fetch all needed.

    async fetchItems(): Promise<JudgableItem[]> {
        // 1. Fetch all Doors
        const doors = await db.doors.toArray();
        // 2. Fetch all Projects (for tags)
        const projects = await db.projects.toArray();
        const projectMap = new Map(projects.map(p => [p.id, p]));

        // 3. Convert to JudgableItems
        return doors.map(door => this.mapDoorToItem(door, projectMap.get(door.projectId!)));
    }

    async updateItemStatus(id: string | number, status: JudgmentStatus): Promise<void> {
        // Map JBWOS status back to Domain status
        // core status: inbox | ready | waiting | pending | done
        // domain door.judgmentStatus: same (luckily matches for now)

        // Ensure ID is number because Dexie uses number for autoInc
        const doorId = Number(id);

        await db.doors.update(doorId, {
            judgmentStatus: status,
            updatedAt: new Date()
        });
    }

    private mapDoorToItem(door: Door, project: Project | undefined): JudgableItem {
        return {
            id: door.id!, // Assumes saved door has ID
            title: door.name || 'Unnamed Item',
            status: this.paramsToStatus(door.judgmentStatus),
            tags: project ? [project.name] : ['No Project'],
            description: door.type === 'door' ? `${door.dimensions?.width}x${door.dimensions?.height}` : 'General Task',
            metadata: {
                originalType: 'door',
                projectId: door.projectId
            }
        };
    }

    private paramsToStatus(s: string | undefined): JudgmentStatus {
        if (!s) return 'inbox';
        // Validate cast or fallback
        if (['inbox', 'ready', 'waiting', 'pending', 'done'].includes(s)) {
            return s as JudgmentStatus;
        }
        return 'inbox';
    }
}
