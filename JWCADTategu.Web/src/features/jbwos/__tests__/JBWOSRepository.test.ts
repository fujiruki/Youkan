import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../../../db/db';
import { JBWOSRepository } from '../repositories/JBWOSRepository';
import { Item } from '../types';
import { v4 as uuidv4 } from 'uuid';

describe('JBWOSRepository', () => {
    const repository = new JBWOSRepository();

    beforeEach(async () => {
        await db.items.clear();
    });

    it('should add an item to inbox', async () => {
        const title = 'Test Item';
        await repository.addItemToInbox(title);

        const items = await db.items.toArray();
        expect(items).toHaveLength(1);
        expect(items[0].title).toBe(title);
        expect(items[0].status).toBe('inbox');
        expect(items[0].interrupt).toBe(false);
    });

    it('should retrieve items filtered by status', async () => {
        // Setup
        const item1: Item = {
            id: uuidv4(), title: 'Inbox 1', status: 'inbox', statusUpdatedAt: Date.now(),
            interrupt: false, weight: 1, createdAt: Date.now(), updatedAt: Date.now()
        };
        const item2: Item = {
            id: uuidv4(), title: 'Ready 1', status: 'ready', statusUpdatedAt: Date.now(),
            interrupt: false, weight: 1, createdAt: Date.now(), updatedAt: Date.now()
        };
        await db.items.bulkAdd([item1, item2]);

        // Act
        const inboxItems = await repository.getItemsByStatus('inbox');
        const readyItems = await repository.getItemsByStatus('ready');

        // Assert
        expect(inboxItems).toHaveLength(1);
        expect(inboxItems[0].title).toBe('Inbox 1');
        expect(readyItems).toHaveLength(1);
        expect(readyItems[0].title).toBe('Ready 1');
    });

    it('should update item status', async () => {
        const id = uuidv4();
        const item: Item = {
            id, title: 'Item', status: 'inbox', statusUpdatedAt: Date.now(),
            interrupt: false, weight: 1, createdAt: Date.now(), updatedAt: Date.now()
        };
        await db.items.add(item);

        await repository.updateStatus(id, 'ready');

        const updated = await db.items.get(id);
        expect(updated?.status).toBe('ready');
    });
});
