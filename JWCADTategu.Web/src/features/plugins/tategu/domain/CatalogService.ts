import { db, CatalogItemEntity } from '../../../../db/db';
import { CatalogItem } from './DoorSpecs';
import { v4 as uuidv4 } from 'uuid';

export const CatalogService = {
    // 全件取得 (新しい順)
    async getAll(): Promise<CatalogItem[]> {
        return await db.catalog.orderBy('updatedAt').reverse().toArray();
    },

    // 検索
    async search(query: string): Promise<CatalogItem[]> {
        if (!query) return this.getAll();
        const lower = query.toLowerCase();

        // シンプルなクライアントサイドフィルタ
        // Dexieのstartswith等も使えるが、ここでは柔軟性重視
        return await db.catalog
            .filter(item =>
                item.name.toLowerCase().includes(lower) ||
                item.category.toLowerCase().includes(lower) ||
                item.keywords.some(k => k.toLowerCase().includes(lower))
            )
            .toArray();
    },

    // 登録
    async add(item: Omit<CatalogItem, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
        const id = uuidv4();
        const now = Date.now();

        const newItem: CatalogItemEntity = {
            ...item,
            id,
            createdAt: now,
            updatedAt: now
        };

        await db.catalog.add(newItem);
        return id;
    },

    // 更新
    async update(id: string, updates: Partial<Omit<CatalogItem, 'id' | 'createdAt'>>): Promise<void> {
        await db.catalog.update(id, {
            ...updates,
            updatedAt: Date.now()
        });
    },

    // 削除
    async delete(id: string): Promise<void> {
        await db.catalog.delete(id);
    }
};
