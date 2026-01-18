/**
 * Manufacturing Plugin - Repository
 * 
 * 成果物（Deliverable）のCRUD操作を提供するリポジトリ
 */

import {
    Deliverable,
    DeliverableCreateRequest,
    DeliverableUpdateRequest,
    ProjectSummary
} from './types';

const API_BASE = '/api/deliverables';

/**
 * 成果物リポジトリ
 */
export const deliverableRepository = {
    /**
     * プロジェクトの成果物一覧を取得
     */
    async getByProject(projectId: string): Promise<Deliverable[]> {
        const response = await fetch(`${API_BASE}?projectId=${projectId}`);
        if (!response.ok) throw new Error('Failed to fetch deliverables');
        return response.json();
    },

    /**
     * 成果物を取得
     */
    async getById(id: string): Promise<Deliverable | null> {
        const response = await fetch(`${API_BASE}/${id}`);
        if (response.status === 404) return null;
        if (!response.ok) throw new Error('Failed to fetch deliverable');
        return response.json();
    },

    /**
     * 成果物を作成
     */
    async create(data: DeliverableCreateRequest): Promise<Deliverable> {
        const response = await fetch(API_BASE, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!response.ok) throw new Error('Failed to create deliverable');
        return response.json();
    },

    /**
     * 成果物を更新
     */
    async update(id: string, data: DeliverableUpdateRequest): Promise<Deliverable> {
        const response = await fetch(`${API_BASE}/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!response.ok) throw new Error('Failed to update deliverable');
        return response.json();
    },

    /**
     * 成果物を削除
     */
    async delete(id: string): Promise<void> {
        const response = await fetch(`${API_BASE}/${id}`, {
            method: 'DELETE'
        });
        if (!response.ok) throw new Error('Failed to delete deliverable');
    },

    /**
     * プロジェクトの集計情報を取得
     */
    async getProjectSummary(projectId: string): Promise<ProjectSummary> {
        const response = await fetch(`${API_BASE}/summary/${projectId}`);
        if (!response.ok) throw new Error('Failed to fetch project summary');
        return response.json();
    }
};
