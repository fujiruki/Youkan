import { describe, it, expect } from 'vitest';
import { Item, Project } from '../types';

/**
 * [TDD] Item Model & Title Unification Test
 */
describe('Item Model Refinement', () => {

    it('should support "title" as the primary display property for Items', () => {
        const item: Partial<Item> = {
            id: '1',
            title: 'Test Task'
        };
        expect(item.title).toBe('Test Task');
    });

    it('should support "title" for Project entities (Transition from name)', () => {
        // We will add 'title' to Project interface
        const project: Partial<Project> = {
            id: 'p1',
            title: 'Test Project'
        };
        expect(project.title).toBe('Test Project');
    });

    it('should maintain backward compatibility for "name" in Projects (Deprecated)', () => {
        const project: Partial<Project> = {
            id: 'p1',
            name: 'Deprecated Name',
            title: 'New Title'
        };
        expect(project.name).toBe('Deprecated Name');
    });
});
