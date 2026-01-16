import { describe, it, expect, beforeEach } from 'vitest';
import { projectCategoryManager } from '../services/ProjectCategoryManager';
import { assigneeManager } from '../services/AssigneeManager';

describe('ProjectCategoryManager', () => {
    beforeEach(() => {
        // Reset to default state
        localStorage.clear();
    });

    it('should have default "general" category', () => {
        const categories = projectCategoryManager.getAllCategories();
        expect(categories).toHaveLength(1);
        expect(categories[0].id).toBe('general');
        expect(categories[0].name).toBe('一般プロジェクト');
    });

    it('should add custom category', async () => {
        const newCategory = await projectCategoryManager.addCustomCategory({
            name: 'テストプロジェクト',
            icon: '🧪',
            defaultTasks: [
                { title: 'タスク1', estimatedMinutes: 60 }
            ]
        });

        expect(newCategory.id).toContain('custom-');
        expect(newCategory.name).toBe('テストプロジェクト');
        expect(newCategory.isCustom).toBe(true);

        const categories = projectCategoryManager.getAllCategories();
        expect(categories).toHaveLength(2);
    });

    it('should add categories from plugin', () => {
        projectCategoryManager.addCategoriesFromPlugin('test-plugin', [
            {
                id: 'test-category',
                name: 'プラグインカテゴリー',
                icon: '🔌',
                defaultTasks: [],
                createdAt: Date.now()
            }
        ]);

        const categories = projectCategoryManager.getAllCategories();
        expect(categories).toHaveLength(2);
        expect(categories[1].pluginId).toBe('test-plugin');
    });

    it('should remove categories when plugin is removed', () => {
        projectCategoryManager.addCategoriesFromPlugin('test-plugin', [
            {
                id: 'test-category',
                name: 'プラグインカテゴリー',
                icon: '🔌',
                defaultTasks: [],
                createdAt: Date.now()
            }
        ]);

        projectCategoryManager.removeCategoriesFromPlugin('test-plugin');

        const categories = projectCategoryManager.getAllCategories();
        expect(categories).toHaveLength(1);
        expect(categories[0].id).toBe('general');
    });
});

describe('AssigneeManager', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it('should start with empty assignees', () => {
        const assignees = assigneeManager.getAllAssignees();
        expect(assignees).toHaveLength(0);
    });

    it('should add new assignee', async () => {
        const newAssignee = await assigneeManager.addAssignee({
            name: '太郎さん',
            type: 'internal'
        });

        expect(newAssignee.id).toContain('assignee-');
        expect(newAssignee.name).toBe('太郎さん');
        expect(newAssignee.type).toBe('internal');

        const assignees = assigneeManager.getAllAssignees();
        expect(assignees).toHaveLength(1);
    });

    it('should filter internal and external assignees', async () => {
        await assigneeManager.addAssignee({
            name: '太郎さん',
            type: 'internal'
        });

        await assigneeManager.addAssignee({
            name: '山田工務店',
            type: 'external'
        });

        const internal = assigneeManager.getInternalAssignees();
        const external = assigneeManager.getExternalAssignees();

        expect(internal).toHaveLength(1);
        expect(external).toHaveLength(1);
        expect(internal[0].name).toBe('太郎さん');
        expect(external[0].name).toBe('山田工務店');
    });

    it('should update assignee', async () => {
        const assignee = await assigneeManager.addAssignee({
            name: '太郎さん',
            type: 'internal'
        });

        await assigneeManager.updateAssignee(assignee.id, {
            contact: '090-1234-5678'
        });

        const updated = assigneeManager.getAssigneeById(assignee.id);
        expect(updated?.contact).toBe('090-1234-5678');
    });

    it('should delete assignee', async () => {
        const assignee = await assigneeManager.addAssignee({
            name: '太郎さん',
            type: 'internal'
        });

        await assigneeManager.deleteAssignee(assignee.id);

        const assignees = assigneeManager.getAllAssignees();
        expect(assignees).toHaveLength(0);
    });
});
