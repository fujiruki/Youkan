import { ProjectCategory } from '../types';

/**
 * プロジェクト分類を管理するサービスクラス
 */
export class ProjectCategoryManager {
    private static instance: ProjectCategoryManager;
    private categories: ProjectCategory[] = [];

    private constructor() {
        this.initializeDefaultCategories();
    }

    public static getInstance(): ProjectCategoryManager {
        if (!ProjectCategoryManager.instance) {
            ProjectCategoryManager.instance = new ProjectCategoryManager();
        }
        return ProjectCategoryManager.instance;
    }

    /**
     * デフォルト分類を初期化
     */
    private initializeDefaultCategories(): void {
        this.categories = [
            {
                id: 'general',
                name: '一般プロジェクト',
                icon: '📋',
                defaultTasks: [],
                domain: 'general',
                isCustom: false,
                createdAt: Date.now()
            }
        ];
    }

    /**
     * すべての分類を取得
     */
    public getAllCategories(): ProjectCategory[] {
        return [...this.categories];
    }

    /**
     * デフォルト分類を取得
     */
    public getDefaultCategories(): ProjectCategory[] {
        return this.categories.filter(c => !c.isCustom && !c.pluginId);
    }

    /**
     * 分類IDから分類を取得
     */
    public getCategoryById(id: string): ProjectCategory | undefined {
        return this.categories.find(c => c.id === id);
    }

    /**
     * プラグインから分類を追加
     */
    public addCategoriesFromPlugin(pluginId: string, categories: ProjectCategory[]): void {
        // 既存のプラグイン分類を削除
        this.categories = this.categories.filter(c => c.pluginId !== pluginId);

        // 新しい分類を追加
        const categoriesWithPlugin = categories.map(c => ({
            ...c,
            pluginId,
            domain: c.domain || 'business', // Plugin defaults to business unless specified
            isCustom: false
        }));

        this.categories.push(...categoriesWithPlugin);
    }

    /**
     * プラグインの分類を削除
     */
    public removeCategoriesFromPlugin(pluginId: string): void {
        this.categories = this.categories.filter(c => c.pluginId !== pluginId);
    }

    /**
     * カスタム分類を追加
     */
    public async addCustomCategory(category: Omit<ProjectCategory, 'id' | 'createdAt' | 'isCustom'>): Promise<ProjectCategory> {
        const newCategory: ProjectCategory = {
            ...category,
            id: `custom-${Date.now()}`,
            isCustom: true,
            createdAt: Date.now()
        };

        this.categories.push(newCategory);

        // LocalStorageに保存
        this.saveToLocalStorage();

        return newCategory;
    }

    /**
     * カスタム分類を更新
     */
    public async updateCategory(id: string, updates: Partial<ProjectCategory>): Promise<void> {
        const index = this.categories.findIndex(c => c.id === id);
        if (index === -1) {
            throw new Error(`Category with id ${id} not found`);
        }

        // カスタム分類のみ更新可能
        if (!this.categories[index].isCustom) {
            throw new Error('Cannot update non-custom category');
        }

        this.categories[index] = {
            ...this.categories[index],
            ...updates
        };

        this.saveToLocalStorage();
    }

    /**
     * カスタム分類を削除
     */
    public async deleteCategory(id: string): Promise<void> {
        const category = this.categories.find(c => c.id === id);
        if (!category) {
            throw new Error(`Category with id ${id} not found`);
        }

        // カスタム分類のみ削除可能
        if (!category.isCustom) {
            throw new Error('Cannot delete non-custom category');
        }

        this.categories = this.categories.filter(c => c.id !== id);
        this.saveToLocalStorage();
    }

    /**
     * LocalStorageに保存
     */
    private saveToLocalStorage(): void {
        const customCategories = this.categories.filter(c => c.isCustom);
        localStorage.setItem('jbwos-custom-categories', JSON.stringify(customCategories));
    }

    /**
     * LocalStorageから読み込み
     */
    public loadFromLocalStorage(): void {
        const stored = localStorage.getItem('jbwos-custom-categories');
        if (stored) {
            try {
                const customCategories: ProjectCategory[] = JSON.parse(stored);
                // カスタム分類を追加（既存のカスタム分類は削除）
                this.categories = this.categories.filter(c => !c.isCustom);
                this.categories.push(...customCategories);
            } catch (e) {
                console.error('Failed to load custom categories from localStorage', e);
            }
        }
    }
}

// シングルトンインスタンスをエクスポート
export const projectCategoryManager = ProjectCategoryManager.getInstance();
