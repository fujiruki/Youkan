import { db } from '../../../db/db';
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

    async getItemsByStatus(status: JudgmentStatus): Promise<Item[]> {
        return await db.items
            .where('status')
            .equals(status)
            .reverse() // Newest first by default? sorting logic might need refinement later
            .sortBy('statusUpdatedAt');
    }

    async updateStatus(id: string, status: JudgmentStatus): Promise<void> {
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
}
