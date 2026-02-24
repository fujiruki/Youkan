import { db, Door } from '../db/db';
import { Project as LocalProject } from '../features/core/youkan/types';
import { DefaultEstimationSettings } from '../features/plugins/tategu/domain/EstimationSettings';

export class ProjectRepository {
    async createProjectDraft(title: string): Promise<LocalProject> {
        let settings = DefaultEstimationSettings;
        try {
            const saved = localStorage.getItem('globalEstimationSettings');
            if (saved) {
                settings = { ...DefaultEstimationSettings, ...JSON.parse(saved) };
            }
        } catch (e) {
            console.warn("Using default settings due to parse error", e);
        }

        return {
            title,
            name: title, // Maintain for backward compatibility if needed
            settings,
            grossProfitTarget: 0,
            isArchived: false,
            createdAt: Date.now(),
            updatedAt: Date.now()
        };
    }

    async saveProject(p: LocalProject): Promise<number> {
        if (p.id) {
            await db.projects.update(p.id, p);
            return p.id;
        } else {
            return await db.projects.add(p);
        }
    }

    // Additional methods would be restored here
    async getAllProjects(): Promise<LocalProject[]> {
        const list = await db.projects.orderBy('updatedAt').reverse().toArray();
        return list.map(p => ({
            ...p,
            id: p.id,
            title: p.title || p.name || 'Untitled',
            name: p.name || p.title || 'Untitled',
            isArchived: !!p.isArchived,
            grossProfitTarget: (p as any).grossProfitTarget || 0,
            createdAt: typeof p.createdAt === 'number' ? p.createdAt : (p.createdAt instanceof Date ? p.createdAt.getTime() : Date.now()),
            updatedAt: typeof p.updatedAt === 'number' ? p.updatedAt : (p.updatedAt instanceof Date ? p.updatedAt.getTime() : Date.now())
        } as LocalProject));
    }

    async getProject(id: number): Promise<LocalProject | undefined> {
        const p = await db.projects.get(id);
        if (!p) return undefined;
        return {
            ...p,
            id: p.id,
            title: p.title || p.name || 'Untitled',
            name: p.name || p.title || 'Untitled',
            isArchived: !!p.isArchived,
            grossProfitTarget: (p as any).grossProfitTarget || 0,
            createdAt: typeof p.createdAt === 'number' ? p.createdAt : (p.createdAt instanceof Date ? p.createdAt.getTime() : Date.now()),
            updatedAt: typeof p.updatedAt === 'number' ? p.updatedAt : (p.updatedAt instanceof Date ? p.updatedAt.getTime() : Date.now())
        } as LocalProject;
    }

    async deleteProject(id: number) {
        await db.transaction('rw', db.projects, db.doors, async () => {
            await db.doors.where('projectId').equals(id).delete();
            await db.projects.delete(id);
        });
    }

    async saveDoor(door: Door) {
        if (door.id) {
            // Fix: Dexie update expects partial, casting or destructuring implies full update is intent
            await db.doors.update(door.id, { ...door });
            return door.id;
        } else {
            return await db.doors.add(door);
        }
    }
}
export const projectRepository = new ProjectRepository();
