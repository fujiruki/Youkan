import { IProjectCategoryRepository } from '../domain/IProjectCategoryRepository';
import { ProjectCategory } from '../types';
import { ApiClient } from '../../../../api/client';

export class ProjectCategoryRepository implements IProjectCategoryRepository {
    async getAll(): Promise<ProjectCategory[]> {
        return ApiClient.request<ProjectCategory[]>('GET', '/categories');
    }

    async addCustomCategory(category: Omit<ProjectCategory, 'id' | 'createdAt' | 'isCustom'>): Promise<ProjectCategory> {
        const payload = { ...category, is_custom: true };
        const res = await ApiClient.request<{ success: boolean; id: string }>('POST', '/categories', payload);

        return {
            ...category,
            id: String(res.id),
            isCustom: true,
            createdAt: Date.now()
        } as ProjectCategory;
    }

    async updateCategory(id: string, updates: Partial<ProjectCategory>): Promise<void> {
        await ApiClient.request('PUT', `/categories/${id}`, updates);
    }

    async deleteCategory(id: string): Promise<void> {
        await ApiClient.request('DELETE', `/categories/${id}`);
    }
}
