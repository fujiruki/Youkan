import { db, Door, Project } from '../../../db/db';
import { Item, JudgmentStatus } from '../types';
import { v4 as uuidv4 } from 'uuid';

export class JBWOSRepository {

    async addItemToInbox(title: string): Promise<void> {
        const item: Item = {
            id: uuidv4(),
            title,
            status: 'inbox',
            statusUpdatedAt: Date.now(),
            interrupt: false,
            weight: 1, // Default light
            createdAt: Date.now(),
            updatedAt: Date.now()
        };
        try {
            await db.items.add(item);
        } catch (e) {
            console.error('[Repository] DB Error:', e);
            throw e;
        }
    }

    // [MODIFIED] Data Integration Logic
    async getItemsByStatus(status: JudgmentStatus): Promise<Item[]> {
        // 1. Fetch Standard Items (Inbox, etc.)
        const standardItems = await db.items
            .where('status')
            .equals(status)
            .sortBy('statusUpdatedAt');

        let mergedItems = [...standardItems];

        // 2. Fetch Virtual Decisions from Doors (Integration)
        // Rule: Only merge Doors if they are in 'waiting' | 'ready' | 'pending' | 'done'
        // OR if they triggered RDD (Virtual).
        // For MVP, we map Door.judgmentStatus directly to this board.

        // Fetch ALL doors that have this status
        // Note: Dexie index on judgmentStatus exists.
        const doors = await db.doors
            .where('judgmentStatus')
            .equals(status)
            .toArray();

        // Convert Doors to Items
        const dItems = await Promise.all(doors.map(async (d) => this.convertDoorToItem(d)));

        mergedItems = [...mergedItems, ...dItems];

        // Sort by update time descending (newest activity at top usually, but let's stick to statusUpdatedAt)
        // Reverse for standard view?
        return mergedItems.sort((a, b) => b.statusUpdatedAt - a.statusUpdatedAt);
    }

    // Helper: RDD Calculation & Conversion
    private async convertDoorToItem(door: Door): Promise<Item> {
        // Fetch project for Context
        let project: Project | undefined;
        if (door.projectId) {
            project = await db.projects.get(door.projectId);
        }

        // RDD Logic (Simplified for MVP)
        // If roughTiming is set, use it. Else default rules.
        // const rdd = ...

        return {
            id: `door-${door.id}`, // Virtual ID scheme
            title: door.name,
            status: door.judgmentStatus || 'inbox',
            statusUpdatedAt: door.updatedAt.getTime(),
            interrupt: false,
            weight: door.weight || 1,
            projectId: project?.name, // Use name for display
            waitingReason: door.waitingReason,
            doorId: String(door.id),
            category: door.category || 'door',
            type: 'start', // Default decision type for door is "Start Production" decision
            thumbnail: door.thumbnail,
            createdAt: door.createdAt.getTime(),
            updatedAt: door.updatedAt.getTime(),
            // Ensure visual properties
            memo: door.tag + (project ? ` @${project.name}` : '')
        };
    }

    async updateStatus(id: string, status: JudgmentStatus): Promise<void> {
        // [MODIFIED] Handle Virtual ID
        if (id.startsWith('door-')) {
            const doorId = parseInt(id.replace('door-', ''), 10);
            if (!isNaN(doorId)) {
                await db.doors.update(doorId, {
                    judgmentStatus: status, // status is compatible string literal
                    updatedAt: new Date()
                });
                return;
            }
        }

        try {
            await db.items.update(id, {
                status,
                statusUpdatedAt: Date.now(),
                updatedAt: Date.now()
            });
        } catch (e) {
            console.error('[Repository] Update Status Error:', e);
            throw e;
        }
    }

    async updateTitle(id: string, title: string): Promise<void> {
        // [MODIFIED] Handle Virtual ID
        if (id.startsWith('door-')) {
            const doorId = parseInt(id.replace('door-', ''), 10);
            if (!isNaN(doorId)) {
                await db.doors.update(doorId, {
                    name: title,
                    updatedAt: new Date()
                });
                return;
            }
        }

        try {
            await db.items.update(id, {
                title,
                updatedAt: Date.now()
            });
        } catch (e) {
            console.error('[Repository] Update Title Error:', e);
            throw e;
        }
    }

    async markAsInterrupt(id: string): Promise<void> {
        // [MODIFIED] Handle Virtual ID (Doors generally don't become 'interrupt' from GDB in this way, but support it)
        if (id.startsWith('door-')) {
            // Doors interrupt flow? maybe just move to inbox.
            const doorId = parseInt(id.replace('door-', ''), 10);
            await db.doors.update(doorId, {
                judgmentStatus: 'inbox',
                updatedAt: new Date()
                // interrupt support for door needs schema update or just ignore flag
            });
            return;
        }

        await db.items.update(id, {
            status: 'inbox',
            interrupt: true,
            statusUpdatedAt: Date.now(), // interrupt brings to top
            updatedAt: Date.now()
        });
    }

    async getAllItems(): Promise<Item[]> {
        return await db.items.toArray();
    }

    async deleteItem(id: string): Promise<void> {
        // [MODIFIED] Handle Virtual ID
        if (id.startsWith('door-')) {
            // Technically we shouldn't delete doors from here, but for now allow "hiding" or moving to trash?
            // User requirement says "Delete". Let's assume logical delete (status: 'deleted'?) or hard delete.
            // For safety, let's just move to 'trash' status if we had one, or 'inbox' with some flag.
            // But wait, the user explicit requested "Delete".
            // Let's implement hard delete for now, or just remove judgmentStatus so it disappears from board?
            // "Disappears from board" -> judgmentStatus = undefined
            const doorId = parseInt(id.replace('door-', ''), 10);
            if (!isNaN(doorId)) {
                await db.doors.update(doorId, {
                    judgmentStatus: undefined, // Remove from JBWOS flow
                    updatedAt: new Date()
                });
                return;
            }
        }

        try {
            await db.items.delete(id);
        } catch (e) {
            console.error('[Repository] Delete Error:', e);
            throw e;
        }
    }
}
