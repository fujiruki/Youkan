import Dexie, { Table } from 'dexie';
import { DoorDimensions } from '../domain/DoorDimensions';
import { EstimationSettings } from '../domain/EstimationSettings';

export interface Project {
    id?: number;
    name: string;
    client?: string;
    settings?: EstimationSettings;
    updatedAt: Date;
    createdAt: Date;
}

export interface Door {
    id?: number;
    projectId: number;
    tag: string;
    name: string;
    dimensions: DoorDimensions;
    specs: Record<string, any>;
    count: number;
    thumbnail?: string; // Data URL for preview image
    updatedAt: Date;
    createdAt: Date;
}

export class TateguDatabase extends Dexie {
    projects!: Table<Project>;
    doors!: Table<Door>;

    constructor() {
        super('JWCADTateguDB');

        this.version(1).stores({
            projects: '++id, name, updatedAt',
            doors: '++id, projectId, tag, updatedAt'
        });
    }
}

export const db = new TateguDatabase();
