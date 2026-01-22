import { db, Project, Door } from '../../../db/db';
import { AuthService } from '../auth/services/AuthService';
import { ApiClient } from '../../../api/client';

export interface MigrationProgress {
    total: number;
    current: number;
    status: 'idle' | 'running' | 'completed' | 'error';
    log: string[];
}

export class MigrationService {
    private static instance: MigrationService;

    // ID Mapping: Local ID (number) -> Server ID (UUID string)
    private projectMap = new Map<number, string>();

    private constructor() { }

    public static getInstance(): MigrationService {
        if (!MigrationService.instance) {
            MigrationService.instance = new MigrationService();
        }
        return MigrationService.instance;
    }

    public async runMigration(
        onProgress: (progress: MigrationProgress) => void
    ): Promise<void> {
        const progress: MigrationProgress = {
            total: 0,
            current: 0,
            status: 'running',
            log: []
        };

        const log = (msg: string) => {
            progress.log.push(msg);
            onProgress({ ...progress });
        };

        const updateProgress = (inc = 1) => {
            progress.current += inc;
            onProgress({ ...progress });
        };

        try {
            const token = AuthService.getInstance().getToken();
            if (!token) throw new Error('Not authenticated');

            log('Scanning local data...');
            const projects = await db.projects.toArray();
            const doors = await db.doors.toArray();

            progress.total = projects.length + doors.length;
            onProgress({ ...progress });

            log(`Found ${projects.length} projects and ${doors.length} doors.`);

            // 1. Migrate Projects
            for (const p of projects) {
                if (!p.id) {
                    updateProgress();
                    continue; // Should not happen for valid projects
                }

                log(`Migrating Project: ${p.name}...`);
                try {
                    // Prepare Payload
                    const payload = {
                        name: p.name,
                        client: p.client || '',
                        settings: p.settings || {}, // Ensure JSON compatibility
                        dxf_config: p.dxfConfig || {},
                        view_mode: p.viewMode || 'internal',
                        judgment_status: p.judgmentStatus || 'inbox',
                        is_archived: p.isArchived,
                        created_at: p.createdAt?.getTime() || Date.now()
                    };

                    const res = await fetch('/api/projects', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify(payload)
                    });

                    if (!res.ok) throw new Error(`API Error: ${res.statusText}`);

                    const created = await res.json();
                    this.projectMap.set(p.id, created.id); // Valid UUID from server

                    log(`  -> Success (Server ID: ${created.id})`);
                } catch (e: any) {
                    log(`  -> Failed: ${e.message}`);
                }
                updateProgress();
            }

            // 2. Migrate Doors
            for (const d of doors) {
                if (!d.projectId || !this.projectMap.has(d.projectId)) {
                    log(`Skipping Door ${d.name}: Parent Project not found/migrated.`);
                    updateProgress();
                    continue;
                }

                log(`Migrating Door: ${d.name}...`);
                try {
                    const serverProjectId = this.projectMap.get(d.projectId);

                    // Simple cloning of object, ensuring fields match API expectation
                    // Note: 'id' is NOT sent, Server generates it (or we could generate UUID here if API allows)
                    // API (DoorController) accepts 'id'. If we don't send it, it generates one.

                    const payload = {
                        project_id: serverProjectId,
                        name: d.name,
                        count: d.count,
                        tag: d.tag,
                        thumbnail_url: d.thumbnailUrl,
                        status: d.status,
                        man_hours: d.manHours,
                        complexity: d.complexity,
                        start_date: d.startDate?.toISOString(), // API expects string? Controller says ?? null.
                        due_date: d.dueDate?.toISOString(),
                        category: d.category,
                        judgment_status: d.judgmentStatus,
                        waiting_reason: d.waitingReason,
                        weight: d.weight,
                        rough_timing: d.roughTiming,
                        dimensions: d.dimensions,
                        specs: d.specs,
                        generic_specs: d.genericSpecs,
                        created_at: d.createdAt?.getTime()
                    };

                    const res = await fetch('/api/doors', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify(payload)
                    });

                    if (!res.ok) throw new Error(`API Error: ${res.statusText}`);
                    log(`  -> Success`);

                } catch (e: any) {
                    log(`  -> Failed: ${e.message}`);
                }
                updateProgress();
            }

            progress.status = 'completed';
            log('Migration Completed.');
            onProgress({ ...progress });

        } catch (e: any) {
            progress.status = 'error';
            log(`Critical Error: ${e.message}`);
            onProgress({ ...progress });
        }
    }
}
