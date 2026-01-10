import Dexie, { Table } from 'dexie';
import { DoorDimensions } from '../domain/DoorDimensions';
import { EstimationSettings } from '../domain/EstimationSettings';
import { DxfLayerConfig } from '../domain/DxfConfig';
import { CatalogItem } from '../domain/DoorSpecs'; // [NEW]

export interface Project {
    id?: number;
    name: string;
    client?: string;
    settings?: EstimationSettings;
    dxfLayerConfig?: DxfLayerConfig;
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

export interface CatalogItemEntity extends CatalogItem {
    // IndexedDB needs optional ID for auto-increment? 
    // Actually CatalogItem usually uses UUID strings.
    // Let's use string id as primary key for Catalog.
}

export class TateguDatabase extends Dexie {
    projects!: Table<Project>;
    doors!: Table<Door>;
    catalog!: Table<CatalogItemEntity>; // [NEW]

    constructor() {
        super('JWCADTateguDB');

        this.version(2).stores({ // Bump version
            projects: '++id, name, updatedAt',
            doors: '++id, projectId, tag, updatedAt',
            catalog: 'id, name, category, *keywords, updatedAt' // [NEW] id is string UUID
        });

        // Backward compatibility for v1
        this.version(1).stores({
            projects: '++id, name, updatedAt',
            doors: '++id, projectId, tag, updatedAt'
        });
    }
}

export const db = new TateguDatabase();
