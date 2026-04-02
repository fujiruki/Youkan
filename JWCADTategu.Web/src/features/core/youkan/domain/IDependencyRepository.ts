import { Dependency } from '../types';

export interface IDependencyRepository {
    getDependencies(itemId?: string): Promise<Dependency[]>;
    createDependency(sourceItemId: string, targetItemId: string): Promise<Dependency>;
    deleteDependency(id: string): Promise<void>;
}
