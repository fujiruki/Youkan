import { ApiClient } from '../../../../api/client';
import { Project } from '../types';

export class ProjectService {
    public static async getAll(): Promise<Project[]> {
        return ApiClient.request<Project[]>('GET', '/projects');
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
        return ApiClient.request<void>('DELETE', `/projects/${id}`);
    }
}
