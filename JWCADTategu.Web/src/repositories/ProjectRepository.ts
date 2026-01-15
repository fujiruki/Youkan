import { db, Project, Door } from '../db/db';
import { DefaultEstimationSettings } from '../features/plugins/tategu/domain/EstimationSettings';

export class ProjectRepository {
    async createProjectDraft(name: string): Promise<Project> {
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
            name,
            settings,
            createdAt: new Date(),
            updatedAt: new Date()
        };
    }

    async saveProject(p: Project): Promise<number> {
        if (p.id) {
            await db.projects.update(p.id, p);
            return p.id;
        } else {
            return await db.projects.add(p);
        }
    }

    // Additional methods would be restored here
    async getProject(id: number) {
        return await db.projects.get(id);
    }

    async getAllProjects() {
        return await db.projects.orderBy('updatedAt').reverse().toArray();
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
