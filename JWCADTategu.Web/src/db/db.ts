import Dexie, { Table } from 'dexie';
import { DoorDimensions } from '../features/plugins/tategu/domain/DoorDimensions';
import { EstimationSettings } from '../features/plugins/tategu/domain/EstimationSettings';
import { DxfLayerConfig } from '../features/plugins/tategu/domain/DxfConfig';
import { CatalogItem } from '../features/plugins/tategu/domain/DoorSpecs';

import { Item } from '../features/core/jbwos/types';
import { Deliverable } from '../features/plugins/manufacturing/types';

export interface Project {
    id?: number;
    title?: string;
    /** @deprecated Use title instead */
    name?: string;
    client?: string;
    settings?: EstimationSettings;
    dxfLayerConfig?: DxfLayerConfig;
    isArchived?: boolean;
    viewMode?: 'internal' | 'external' | 'mixed';
    judgmentStatus?: 'inbox' | 'decision_hold' | 'someday' | 'active' | 'waiting' | 'focus' | 'pending' | 'done';
    userId?: string;
    tenantId?: string;
    cloudId?: string;
    grossProfitTarget: number;
    updatedAt: number | Date;
    createdAt: number | Date;
}

export interface Door {
    id?: number;
    projectId: number;
    tag: string;
    name: string;
    dimensions: DoorDimensions;
    specs: Record<string, any>;
    count: number;
    thumbnail?: string;
    type?: string;
    manHours?: number;
    complexity?: number;
    startDate?: number | Date;
    dueDate?: number | Date;
    status?: 'design' | 'production' | 'completed';
    category?: 'door' | 'frame' | 'furniture' | 'hardware' | 'other';
    genericSpecs?: {
        unit: string;
        note: string;
    };
    deliverableId?: string;
    estimatedWorkMinutes?: number;
    estimatedSiteMinutes?: number;
    judgmentStatus?: 'inbox' | 'waiting' | 'ready' | 'pending' | 'done';
    waitingReason?: string;
    weight?: 1 | 2 | 3;
    roughTiming?: 'early_month' | 'mid_month' | 'late_month' | 'future';
    updatedAt: number | Date;
    createdAt: number | Date;
}

export interface Task {
    id?: number;
    projectId: number;
    doorId?: number;
    title: string;
    note?: string;
    startDate?: number | Date;
    dueDate?: number | Date;
    manHours?: number;
    status: 'todo' | 'doing' | 'done';
    createdAt: Date;
}

export interface FieldNote {
    id?: number;
    projectId: number;
    content: string;
    photoBlob?: Blob;
    mimeType?: string;
    createdAt: number | Date;
}

export interface CatalogItemEntity extends CatalogItem { }

export interface DoorPhoto {
    id?: number;
    doorId: number;
    blob: Blob;
    mimeType: string;
    memo?: string;
    createdAt: Date;
}

export interface Settings {
    id: string;
    value: any;
    createdAt?: number | Date;
    updatedAt?: number | Date;
}

export class TateguDatabase extends Dexie {
    projects!: Table<Project>;
    doors!: Table<Door>;
    catalog!: Table<CatalogItemEntity>;
    doorPhotos!: Table<DoorPhoto>;
    tasks!: Table<Task>;
    fieldNotes!: Table<FieldNote>;
    items!: Table<Item>;
    settings!: Table<Settings>;
    deliverables!: Table<Deliverable>;

    constructor() {
        super('JWCADTateguDB');

        this.version(18).stores({
            projects: '++id, userId, title, name, isArchived, judgmentStatus, updatedAt',
            doors: '++id, projectId, tag, status, category, judgmentStatus, deliverableId, updatedAt',
            catalog: 'id, name, category, *keywords, updatedAt',
            doorPhotos: '++id, doorId',
            tasks: '++id, projectId, doorId, status, startDate, dueDate',
            fieldNotes: '++id, projectId, createdAt',
            items: 'id, status, statusUpdatedAt, interrupt, dueHook, projectId, doorId, parentId, createdAt',
            settings: 'id',
            deliverables: 'id, projectId, status, judgmentStatus, updatedAt'
        }).upgrade(async tx => {
            await tx.table('projects').toCollection().modify(p => {
                if (!p.title) p.title = p.name;
            });
        });

        this.version(17).stores({
            projects: '++id, userId, name, isArchived, judgmentStatus, updatedAt',
            doors: '++id, projectId, tag, status, category, judgmentStatus, deliverableId, updatedAt',
            catalog: 'id, name, category, *keywords, updatedAt',
            doorPhotos: '++id, doorId',
            tasks: '++id, projectId, doorId, status, startDate, dueDate',
            fieldNotes: '++id, projectId, createdAt',
            items: 'id, status, statusUpdatedAt, interrupt, dueHook, projectId, doorId, parentId, createdAt',
            settings: 'id',
            deliverables: 'id, projectId, status, judgmentStatus, updatedAt'
        }).upgrade(async tx => {
            let userId = 'legacy_user';
            try {
                const stored = localStorage.getItem('jbwos_user');
                if (stored) {
                    const u = JSON.parse(stored);
                    if (u && u.id) userId = u.id;
                }
            } catch (e) { }
            await tx.table('projects').toCollection().modify(p => {
                p.userId = userId;
            });
        });

        this.version(16).stores({
            projects: '++id, name, isArchived, judgmentStatus, updatedAt',
            doors: '++id, projectId, tag, status, category, judgmentStatus, deliverableId, updatedAt',
            catalog: 'id, name, category, *keywords, updatedAt',
            doorPhotos: '++id, doorId',
            tasks: '++id, projectId, doorId, status, startDate, dueDate',
            fieldNotes: '++id, projectId, createdAt',
            items: 'id, status, statusUpdatedAt, interrupt, dueHook, projectId, doorId, parentId, createdAt',
            settings: 'id',
            deliverables: 'id, projectId, status, judgmentStatus, updatedAt'
        });

        this.version(14).stores({
            projects: '++id, name, isArchived, judgmentStatus, updatedAt',
            doors: '++id, projectId, tag, status, category, judgmentStatus, deliverableId, updatedAt',
            catalog: 'id, name, category, *keywords, updatedAt',
            doorPhotos: '++id, doorId',
            tasks: '++id, projectId, doorId, status, startDate, dueDate',
            fieldNotes: '++id, projectId, createdAt',
            items: 'id, status, statusUpdatedAt, interrupt, dueHook, projectId, doorId, parentId, createdAt',
            settings: 'id'
        }).upgrade(async tx => {
            await tx.table('projects').toCollection().modify(p => {
                p.judgmentStatus = 'inbox';
            });
        });

        this.version(13).stores({
            projects: '++id, name, isArchived, updatedAt',
            doors: '++id, projectId, tag, status, category, judgmentStatus, deliverableId, updatedAt',
            catalog: 'id, name, category, *keywords, updatedAt',
            doorPhotos: '++id, doorId',
            tasks: '++id, projectId, doorId, status, startDate, dueDate',
            fieldNotes: '++id, projectId, createdAt',
            items: 'id, status, statusUpdatedAt, interrupt, dueHook, projectId, doorId, parentId, createdAt',
            settings: 'id'
        });
    }
}

export const db = new TateguDatabase();
