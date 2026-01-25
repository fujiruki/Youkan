import { useState, useEffect, useCallback } from 'react';
import { ProjectCategory } from '../types';
import { ProjectCategoryRepository } from '../repositories/ProjectCategoryRepository';

export const useProjectCategories = () => {
    const [categories, setCategories] = useState<ProjectCategory[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const repository = new ProjectCategoryRepository();

    const fetchCategories = useCallback(async () => {
        setLoading(true);
        try {
            const data = await repository.getAll();

            // Default Categories (Hardcoded for Cloud Transition Phase 9)
            const defaults: ProjectCategory[] = [
                {
                    id: 'general',
                    name: '一般プロジェクト',
                    icon: '📋',
                    domain: 'general',
                    defaultTasks: [],
                    isCustom: false,
                    createdAt: 0
                },
                {
                    id: 'tategu_construction',
                    name: '建具工事',
                    icon: '🚪',
                    domain: 'business',
                    defaultTasks: [
                        { title: '現場調査', estimatedMinutes: 120 },
                        { title: '見積作成', estimatedMinutes: 60 },
                        { title: '製作図面作成', estimatedMinutes: 180 },
                        { title: '製作', estimatedMinutes: 480 },
                        { title: '納品・取付', estimatedMinutes: 240 }
                    ],
                    isCustom: false,
                    createdAt: 0
                }
            ];

            // Merge: Prefer DB if ID collision (unlikely for strings vs numbers/uuids)
            // But DB categories are custom.
            setCategories([...defaults, ...data]);
            setError(null);
        } catch (err) {
            console.error(err);
            setError('Failed to fetch categories');
        } finally {
            setLoading(false);
        }
    }, []);

    const addCustomCategory = async (category: Omit<ProjectCategory, 'id' | 'createdAt' | 'isCustom'>) => {
        try {
            const newOne = await repository.addCustomCategory(category);
            setCategories(prev => [...prev, newOne]);
            return newOne;
        } catch (err) {
            console.error(err);
            throw err;
        }
    };

    const updateCategory = async (id: string, updates: Partial<ProjectCategory>) => {
        try {
            await repository.updateCategory(id, updates);
            setCategories(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
        } catch (err) {
            console.error(err);
            throw err;
        }
    };

    const deleteCategory = async (id: string) => {
        try {
            await repository.deleteCategory(id);
            setCategories(prev => prev.filter(c => c.id !== id));
        } catch (err) {
            console.error(err);
            throw err;
        }
    };

    useEffect(() => {
        fetchCategories();
    }, [fetchCategories]);

    return {
        categories,
        loading,
        error,
        refresh: fetchCategories,
        addCustomCategory,
        updateCategory,
        deleteCategory
    };
};
