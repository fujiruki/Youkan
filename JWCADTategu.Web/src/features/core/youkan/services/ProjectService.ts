import { ApiClient } from '../../../../api/client';
import { Project } from '../types';

export class ProjectService {
    public static async getAll(options?: { scope?: 'personal' | 'company' | 'dashboard' | 'aggregated' }): Promise<Project[]> {
        return ApiClient.getProjects(options);
    }

    public static async getById(id: string): Promise<Project> {
        return ApiClient.request<Project>('GET', `/projects/${id}`);
    }

    public static async create(project: Partial<Project>): Promise<Project> {
        return ApiClient.request<Project>('POST', '/projects', project);
    }

    public static async update(id: string, updates: Partial<Project>): Promise<Project> {
        return ApiClient.request<Project>('PUT', `/projects/${id}`, updates);
    }

    public static async delete(id: string): Promise<void> {
        // [UPDATE] Delete now means 'Move to Trash' usually, but 'delete' endpoint in ProjectController was permanent.
        // User wants 'Trash' flow. 
        // We will keep 'delete' as is (ProjectController delete), but add new methods.
        // The ViewModel will decide which one to call.
        return ApiClient.request<void>('DELETE', `/projects/${id}`);
    }

    // [New] Archive & Trash Support (Using ItemController endpoints because Project is an Item)
    public static async archive(id: string): Promise<void> {
        return ApiClient.request<void>('POST', `/items/${id}/archive`);
    }

    public static async trash(id: string): Promise<void> {
        return ApiClient.request<void>('POST', `/items/${id}/trash`);
    }

    public static async restore(id: string): Promise<void> {
        return ApiClient.request<void>('POST', `/items/${id}/restore`);
    }

    public static async destroy(id: string): Promise<void> {
        return ApiClient.request<void>('POST', `/items/${id}/destroy`);
    }
}
