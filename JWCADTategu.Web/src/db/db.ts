import Dexie, { Table } from 'dexie';
import { DoorDimensions } from '../features/plugins/tategu/domain/DoorDimensions';
import { EstimationSettings } from '../features/plugins/tategu/domain/EstimationSettings';
import { DxfLayerConfig } from '../features/plugins/tategu/domain/DxfConfig';
import { CatalogItem } from '../features/plugins/tategu/domain/DoorSpecs';
import { Item } from '../features/core/jbwos/types'; // [NEW]

export interface Project {
    id?: number;
    name: string;
    client?: string;
    settings?: EstimationSettings;
    dxfLayerConfig?: DxfLayerConfig;
    isArchived?: boolean; // [NEW]
    viewMode?: 'internal' | 'external'; // [NEW]
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
    type?: string; // [RESTORED] For backward compatibility

    // Schedule & Management Fields [NEW]
    manHours?: number; // Standard production hours
    complexity?: number; // 0.5 - 2.0 coefficient
    startDate?: Date;
    dueDate?: Date;
    status?: 'design' | 'production' | 'completed';

    // Generic/Production Item Fields [NEW]
    category?: 'door' | 'frame' | 'furniture' | 'hardware' | 'other'; // Default 'door'
    genericSpecs?: {
        unit: string;
        note: string;
    };

    // Manufacturing Plugin Integration [NEW]
    deliverableId?: string; // Links to Deliverable in Manufacturing Plugin

    // [NEW] Estimated Time for Manufacturing/Site Work
    estimatedWorkMinutes?: number;  // 製作見積時間（分）
    estimatedSiteMinutes?: number;  // 現場見積時間（分）

    // Constitution Scheduler Fields
    judgmentStatus?: 'inbox' | 'waiting' | 'ready' | 'pending' | 'done';
    waitingReason?: string;
    weight?: 1 | 2 | 3;
    roughTiming?: 'early_month' | 'mid_month' | 'late_month' | 'future';

    updatedAt: Date;
    createdAt: Date;
}

export interface Task {
    id?: number;
    projectId: number;
    doorId?: number; // [NEW] Link to Door
    title: string;
    note?: string;
    startDate?: Date;
    dueDate?: Date;
    manHours?: number;
    status: 'todo' | 'doing' | 'done';
    createdAt: Date;
}

export interface FieldNote {
    id?: number;
    projectId: number;
    content: string;
    photoBlob?: Blob; // Optional photo
    mimeType?: string;
    createdAt: Date;
}

export interface CatalogItemEntity extends CatalogItem {
    // IndexedDB needs optional ID for auto-increment? 
    // Actually CatalogItem usually uses UUID strings.
    // Let's use string id as primary key for Catalog.
}

export interface DoorPhoto {
    id?: number;
    doorId: number;
    blob: Blob;
    mimeType: string;
    memo?: string;
    createdAt: Date;
}

export class TateguDatabase extends Dexie {
    projects!: Table<Project>;
    doors!: Table<Door>;
    catalog!: Table<CatalogItemEntity>;
    doorPhotos!: Table<DoorPhoto>;
    tasks!: Table<Task>;
    fieldNotes!: Table<FieldNote>;
    items!: Table<Item>; // [NEW] JBWOS Items

    constructor() {
        super('JWCADTateguDB');

        this.version(12).stores({
            projects: '++id, name, isArchived, updatedAt',
            doors: '++id, projectId, tag, status, category, judgmentStatus, deliverableId, updatedAt',
            catalog: 'id, name, category, *keywords, updatedAt',
            doorPhotos: '++id, doorId',
            tasks: '++id, projectId, doorId, status, startDate, dueDate', // [NEW] Added doorId
            fieldNotes: '++id, projectId, createdAt',
            items: 'id, status, statusUpdatedAt, interrupt, dueHook, projectId, doorId, parentId, createdAt'
        });

        this.version(11).stores({
            projects: '++id, name, isArchived, updatedAt',
            doors: '++id, projectId, tag, status, category, judgmentStatus, deliverableId, updatedAt', // Added deliverableId
            catalog: 'id, name, category, *keywords, updatedAt',
            doorPhotos: '++id, doorId',
            tasks: '++id, projectId, status, startDate, dueDate',
            fieldNotes: '++id, projectId, createdAt',
            items: 'id, status, statusUpdatedAt, interrupt, dueHook, projectId, doorId, parentId, createdAt'
        });

        this.version(10).stores({
            projects: '++id, name, isArchived, updatedAt',
            doors: '++id, projectId, tag, status, category, judgmentStatus, updatedAt',
            catalog: 'id, name, category, *keywords, updatedAt',
            doorPhotos: '++id, doorId',
            tasks: '++id, projectId, status, startDate, dueDate',
            fieldNotes: '++id, projectId, createdAt',
            items: 'id, status, statusUpdatedAt, interrupt, dueHook, projectId, doorId, parentId, createdAt' // [NEW] parentId index
        });

        this.version(9).stores({
            projects: '++id, name, isArchived, updatedAt', // Added isArchived to index
            doors: '++id, projectId, tag, status, category, judgmentStatus, updatedAt',
            catalog: 'id, name, category, *keywords, updatedAt',
            doorPhotos: '++id, doorId',
            tasks: '++id, projectId, status, startDate, dueDate',
            fieldNotes: '++id, projectId, createdAt',
            items: 'id, status, statusUpdatedAt, interrupt, dueHook, projectId, doorId, createdAt'
        });

        this.version(8).stores({
            projects: '++id, name, updatedAt',
            doors: '++id, projectId, tag, status, category, judgmentStatus, updatedAt',
            catalog: 'id, name, category, *keywords, updatedAt',
            doorPhotos: '++id, doorId',
            tasks: '++id, projectId, status, startDate, dueDate',
            fieldNotes: '++id, projectId, createdAt',
            items: 'id, status, statusUpdatedAt, interrupt, dueHook, projectId, doorId, createdAt' // [NEW] JBWOS Items
        });

        this.version(7).stores({
            projects: '++id, name, updatedAt',
            doors: '++id, projectId, tag, status, category, judgmentStatus, updatedAt',
            catalog: 'id, name, category, *keywords, updatedAt',
            doorPhotos: '++id, doorId',
            tasks: '++id, projectId, status, startDate, dueDate',
            fieldNotes: '++id, projectId, createdAt'
        }).upgrade(async tx => {
            // For existing doors, set judgmentStatus to 'inbox'
            await tx.table('doors').toCollection().modify(door => {
                door.judgmentStatus = 'inbox';
            });
        });

        this.version(6).stores({
            projects: '++id, name, updatedAt',
            doors: '++id, projectId, tag, status, category, updatedAt',
            catalog: 'id, name, category, *keywords, updatedAt',
            doorPhotos: '++id, doorId',
            tasks: '++id, projectId, status, startDate, dueDate',
            fieldNotes: '++id, projectId, createdAt'
        });

        this.version(5).stores({
            projects: '++id, name, updatedAt',
            doors: '++id, projectId, tag, status, updatedAt',
            catalog: 'id, name, category, *keywords, updatedAt',
            doorPhotos: '++id, doorId',
            tasks: '++id, projectId, status, startDate, dueDate',
            fieldNotes: '++id, projectId, createdAt'
        });

        this.version(4).stores({
            projects: '++id, name, updatedAt',
            doors: '++id, projectId, tag, updatedAt',
            catalog: 'id, name, category, *keywords, updatedAt',
            doorPhotos: '++id, doorId',
            tasks: '++id, projectId, status, startDate, dueDate',
            fieldNotes: '++id, projectId, createdAt'
        });

        this.version(2).stores({
            projects: '++id, name, updatedAt',
            doors: '++id, projectId, tag, updatedAt',
            catalog: 'id, name, category, *keywords, updatedAt'
        });

        // Backward compatibility for v1
        this.version(1).stores({
            projects: '++id, name, updatedAt',
            doors: '++id, projectId, tag, updatedAt'
        });
    }
}

export const db = new TateguDatabase();
