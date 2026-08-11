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
        try {
            const res = await ApiClient.request<{ dependency: Dependency }>('POST', '/dependencies', {
                source_item_id: sourceItemId,
                target_item_id: targetItemId,
            }, true);
            return res.dependency;
        } catch (err) {
            // 409 = 同一の依存関係が既に存在する。呼び出し元が求める終状態
            // （source→target の依存関係が存在すること）は既に達成されているため、
            // エラーではなく成功として扱い、既存の依存関係を返す。
            if (err instanceof Error && (err as Error & { status?: number }).status === 409) {
                const existing = await this.getDependencies(sourceItemId);
                const found = existing.find(
                    (d) => d.sourceItemId === sourceItemId && d.targetItemId === targetItemId
                );
                if (found) return found;
            }
            throw err;
        }
    }

    async deleteDependency(id: string): Promise<void> {
        await ApiClient.request('DELETE', `/dependencies/${id}`);
    }
}
