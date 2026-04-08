import { IDependencyRepository } from '../domain/IDependencyRepository';
import { Dependency } from '../types';
import { ApiClient } from '../../../../api/client';

export class DependencyRepository implements IDependencyRepository {
    async getDependencies(itemId?: string): Promise<Dependency[]> {
        const query = itemId ? `?item_id=${encodeURIComponent(itemId)}` : '';
        const res = await ApiClient.request<{ dependencies: Dependency[] }>('GET', `/dependencies${query}`);
        return res.dependencies;
    }

    async createDependency(sourceItemId: string, targetItemId: string): Promise<Dependency> {
        const res = await ApiClient.request<{ dependency: Dependency }>('POST', '/dependencies', {
            source_item_id: sourceItemId,
            target_item_id: targetItemId,
        }, true);
        return res.dependency;
    }

    async deleteDependency(id: string): Promise<void> {
        await ApiClient.request('DELETE', `/dependencies/${id}`);
    }
}
