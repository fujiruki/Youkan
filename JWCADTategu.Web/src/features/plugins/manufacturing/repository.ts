import { db } from '../../../db/db';
import {
    Deliverable,
    DeliverableCreateRequest,
    DeliverableUpdateRequest,
    ProjectSummary
} from './types';
import { v4 as uuidv4 } from 'uuid';

/**
 * 成果物リポジトリ (Local Dexie Implementation)
 */
export const deliverableRepository = {
    /**
     * プロジェクトの成果物一覧を取得
     */
    async getByProject(projectId: string): Promise<Deliverable[]> {
        return await db.deliverables
            .where('projectId').equals(projectId)
            .toArray();
    },

    /**
     * 成果物を取得
     */
    async getById(id: string): Promise<Deliverable | null> {
        return (await db.deliverables.get(id)) || null;
    },

    /**
     * 成果物を作成
     */
    async create(data: DeliverableCreateRequest): Promise<Deliverable> {
        const id = uuidv4();
        const now = Date.now();

        const newDeliverable: Deliverable = {
            id,
            ...data,
            createdAt: now,
            updatedAt: now
        };

        await db.deliverables.add(newDeliverable);
        return newDeliverable;
    },

    /**
     * 成果物を更新
     */
    async update(id: string, data: DeliverableUpdateRequest): Promise<Deliverable> {
        const existing = await db.deliverables.get(id);
        if (!existing) throw new Error(`Deliverable ${id} not found`);

        const updated: Deliverable = {
            ...existing,
            ...data,
            updatedAt: Date.now()
        };

        await db.deliverables.put(updated);
        return updated;
    },

    /**
     * 成果物を削除
     */
    async delete(id: string): Promise<void> {
        await db.deliverables.delete(id);
    },

    /**
     * プロジェクトの集計情報を取得
     */
    async getProjectSummary(projectId: string): Promise<ProjectSummary> {
        const deliverables = await this.getByProject(projectId);

        const summary: ProjectSummary = {
            projectId,
            totalEstimatedWorkMinutes: 0,
            totalActualWorkMinutes: 0,
            totalEstimatedSiteMinutes: 0,
            totalActualSiteMinutes: 0,
            totalMaterialCost: 0,
            totalLaborCost: 0,
            totalOutsourceCost: 0,
            deliverableCount: deliverables.length,
            completedCount: 0,
            inProgressCount: 0,
            pendingCount: 0
        };

        for (const d of deliverables) {
            summary.totalEstimatedWorkMinutes += d.estimatedWorkMinutes || 0;
            summary.totalActualWorkMinutes += d.actualWorkMinutes || 0;
            summary.totalEstimatedSiteMinutes += d.estimatedSiteMinutes || 0;
            summary.totalActualSiteMinutes += d.actualSiteMinutes || 0;

            summary.totalMaterialCost += d.materialCost || 0;
            summary.totalLaborCost += d.laborCost || 0;
            summary.totalOutsourceCost += d.outsourceCost || 0;

            if (d.status === 'completed') {
                summary.completedCount++;
            } else if (d.status === 'in_progress') {
                summary.inProgressCount++;
            } else {
                summary.pendingCount++;
            }
        }

        return summary;
    }
};
