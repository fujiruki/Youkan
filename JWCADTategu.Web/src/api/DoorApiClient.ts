// src/api/DoorApiClient.ts
// Cloud-based Door API Client for Tategu Plugin

import { ApiClient } from './client';
import { DoorDimensions } from '../features/plugins/tategu/domain/DoorDimensions';

/**
 * Cloud Door Entity (matching backend schema)
 */
export interface CloudDoor {
    id: string;
    tenant_id: string;
    project_id: string;
    deliverable_id?: string;
    tag: string;
    name: string;
    dimensions_json: string;
    specs_json: string;
    count: number;
    thumbnail_url?: string;
    status: 'design' | 'production' | 'completed';
    man_hours: number;
    complexity: number;
    start_date?: number;
    due_date?: number;
    category: 'door' | 'frame' | 'furniture' | 'hardware' | 'other';
    generic_specs_json?: string;
    judgment_status: 'inbox' | 'waiting' | 'ready' | 'pending' | 'done';
    waiting_reason?: string;
    weight: number;
    rough_timing?: string;
    created_at: number;
    updated_at: number;
}

/**
 * Frontend Door Model (parsed from CloudDoor)
 */
export interface Door {
    id: string;
    projectId: string;
    deliverableId?: string;
    tag: string;
    name: string;
    dimensions: DoorDimensions;
    specs: Record<string, any>;
    count: number;
    thumbnail?: string; // Base64 data URL for preview
    thumbnailUrl?: string;
    status: 'design' | 'production' | 'completed';
    manHours: number;
    complexity: number;
    startDate?: Date;
    dueDate?: Date;
    category: 'door' | 'frame' | 'furniture' | 'hardware' | 'other';
    genericSpecs?: { unit: string; note: string };
    judgmentStatus: 'inbox' | 'waiting' | 'ready' | 'pending' | 'done';
    waitingReason?: string;
    weight: number;
    roughTiming?: string;
    // Manufacturing fields
    estimatedWorkMinutes?: number;
    estimatedSiteMinutes?: number;
    createdAt: Date;
    updatedAt: Date;
}


/**
 * Convert CloudDoor (backend) to Door (frontend)
 */
function toDoor(cloud: CloudDoor): Door {
    return {
        id: cloud.id,
        projectId: cloud.project_id,
        deliverableId: cloud.deliverable_id || undefined,
        tag: cloud.tag,
        name: cloud.name,
        dimensions: JSON.parse(cloud.dimensions_json || '{}'),
        specs: JSON.parse(cloud.specs_json || '{}'),
        count: cloud.count,
        thumbnailUrl: cloud.thumbnail_url || undefined,
        status: cloud.status,
        manHours: cloud.man_hours,
        complexity: cloud.complexity,
        startDate: cloud.start_date ? new Date(cloud.start_date) : undefined,
        dueDate: cloud.due_date ? new Date(cloud.due_date) : undefined,
        category: cloud.category,
        genericSpecs: cloud.generic_specs_json ? JSON.parse(cloud.generic_specs_json) : undefined,
        judgmentStatus: cloud.judgment_status,
        waitingReason: cloud.waiting_reason || undefined,
        weight: cloud.weight,
        roughTiming: cloud.rough_timing || undefined,
        createdAt: new Date(cloud.created_at),
        updatedAt: new Date(cloud.updated_at),
    };
}

/**
 * Convert Door (frontend) to CloudDoor request body
 */
function toCloudDoorRequest(door: Partial<Door>): Record<string, any> {
    const result: Record<string, any> = {};

    if (door.id !== undefined) result.id = door.id;
    if (door.projectId !== undefined) result.project_id = door.projectId;
    if (door.deliverableId !== undefined) result.deliverable_id = door.deliverableId;
    if (door.tag !== undefined) result.tag = door.tag;
    if (door.name !== undefined) result.name = door.name;
    if (door.dimensions !== undefined) result.dimensions = door.dimensions;
    if (door.specs !== undefined) result.specs = door.specs;
    if (door.count !== undefined) result.count = door.count;
    if (door.thumbnailUrl !== undefined) result.thumbnail_url = door.thumbnailUrl;
    if (door.status !== undefined) result.status = door.status;
    if (door.manHours !== undefined) result.man_hours = door.manHours;
    if (door.complexity !== undefined) result.complexity = door.complexity;
    if (door.startDate !== undefined) result.start_date = door.startDate.getTime();
    if (door.dueDate !== undefined) result.due_date = door.dueDate.getTime();
    if (door.category !== undefined) result.category = door.category;
    if (door.genericSpecs !== undefined) result.generic_specs = door.genericSpecs;
    if (door.judgmentStatus !== undefined) result.judgment_status = door.judgmentStatus;
    if (door.waitingReason !== undefined) result.waiting_reason = door.waitingReason;
    if (door.weight !== undefined) result.weight = door.weight;
    if (door.roughTiming !== undefined) result.rough_timing = door.roughTiming;

    return result;
}

/**
 * Door API Client
 */
export class DoorApiClient {
    /**
     * Get all doors (optionally filtered by project)
     */
    static async list(projectId?: string): Promise<Door[]> {
        const path = projectId ? `/doors?projectId=${projectId}` : '/doors';
        const cloudDoors = await ApiClient.request<CloudDoor[]>('GET', path);
        return cloudDoors.map(toDoor);
    }

    /**
     * Get a single door by ID
     */
    static async get(id: string): Promise<Door> {
        const cloudDoor = await ApiClient.request<CloudDoor>('GET', `/doors/${id}`);
        return toDoor(cloudDoor);
    }

    /**
     * Create a new door
     */
    static async create(door: Partial<Door> & { projectId: string; name: string }): Promise<Door> {
        const body = toCloudDoorRequest(door);
        const cloudDoor = await ApiClient.request<CloudDoor>('POST', '/doors', body);
        return toDoor(cloudDoor);
    }

    /**
     * Update an existing door
     */
    static async update(id: string, updates: Partial<Door>): Promise<Door> {
        const body = toCloudDoorRequest(updates);
        const cloudDoor = await ApiClient.request<CloudDoor>('PUT', `/doors/${id}`, body);
        return toDoor(cloudDoor);
    }

    /**
     * Delete a door
     */
    static async delete(id: string): Promise<void> {
        await ApiClient.request<{ success: boolean }>('DELETE', `/doors/${id}`);
    }
}
