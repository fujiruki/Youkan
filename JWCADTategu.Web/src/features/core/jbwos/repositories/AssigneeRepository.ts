import { IAssigneeRepository } from '../domain/IAssigneeRepository';
import { Assignee } from '../types';
import { ApiClient } from '../../../../api/client';

export class AssigneeRepository implements IAssigneeRepository {
    async getAll(): Promise<Assignee[]> {
        return ApiClient.request<Assignee[]>('GET', '/assignees');
    }

    async add(assignee: Omit<Assignee, 'id' | 'createdAt'>): Promise<Assignee> {
        // API returns { success: true, id: string }
        const res = await ApiClient.request<{ success: boolean; id: string }>('POST', '/assignees', assignee);

        // Optimistically return created object with new ID (Time logic handled by client for now or fetch new)
        // For strictness, we should maybe fetch? But for speed, construct it.
        return {
            ...assignee,
            id: String(res.id), // Backend returns ID
            createdAt: Date.now()
        } as Assignee;
    }

    async update(id: string, updates: Partial<Assignee>): Promise<void> {
        await ApiClient.request('PUT', `/assignees/${id}`, updates);
    }

    async delete(id: string): Promise<void> {
        await ApiClient.request('DELETE', `/assignees/${id}`);
    }
}
