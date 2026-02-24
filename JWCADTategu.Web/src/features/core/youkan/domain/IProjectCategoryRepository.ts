import { ProjectCategory } from '../types';

export interface IProjectCategoryRepository {
    getAll(): Promise<ProjectCategory[]>;
    addCustomCategory(category: Omit<ProjectCategory, 'id' | 'createdAt' | 'isCustom'>): Promise<ProjectCategory>;
    updateCategory(id: string, updates: Partial<ProjectCategory>): Promise<void>;
    deleteCategory(id: string): Promise<void>;
}
