import { Assignee } from '../../types';

export interface IAssigneeRepository {
    getAll(): Promise<Assignee[]>;
    add(assignee: Omit<Assignee, 'id' | 'createdAt'>): Promise<Assignee>;
    update(id: string, updates: Partial<Assignee>): Promise<void>;
    delete(id: string): Promise<void>;
}
