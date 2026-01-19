import { Deliverable } from './types';
import { JBWOSRepository } from '../../core/jbwos/repositories/JBWOSRepository';
import { Item } from '../../core/jbwos/types';

const API_BASE = '/api/stocks';

export interface StockItem {
    id: string;
    title: string;
    projectId?: string;
    estimatedMinutes: number;
    dueDate?: string;
    status: 'open' | 'assigned' | 'archived';
    createdAt: number;
}

/**
 * 成果物からStockを作成
 * [Updated] JBWOS Inboxへ直接タスクとして追加する (Stock API廃止/延期)
 */
export async function syncStockFromDeliverable(
    deliverable: Deliverable,
    projectTitle?: string
): Promise<StockItem[]> {
    const createdStocks: StockItem[] = [];
    const now = Date.now();

    // 1. 製作 Job
    if (deliverable.estimatedWorkMinutes > 0) {
        const title = `${projectTitle ? projectTitle + ': ' : ''}${deliverable.name} 製作`;

        try {
            // Create JBWOS Item directly
            const newItem: Omit<Item, 'id' | 'createdAt' | 'updatedAt' | 'statusUpdatedAt'> = {
                title: title,
                status: 'inbox', // Direct to Inbox
                category: 'work', // work category
                type: 'generic',
                weight: 1,
                interrupt: false,
                memo: `[Auto Generated]\nEstimated Work: ${deliverable.estimatedWorkMinutes} min\nSource: ${deliverable.name}`,
                // Link to Deliverable? item.linkedItemId?
                // For now just title is enough relation
            };

            const newId = await JBWOSRepository.createItem(newItem);
            console.log('[StockIntegration] Created Inbox item:', newId, title);

            // Pseudo Stock Item for return
            createdStocks.push({
                id: newId,
                title: title,
                projectId: deliverable.id,
                estimatedMinutes: deliverable.estimatedWorkMinutes,
                status: 'open',
                createdAt: now
            });

        } catch (e) {
            console.error('Error creating stock item:', e);
        }
    }

    // 2. 取付 Job (Optional)
    if (deliverable.requiresSiteInstallation && deliverable.estimatedSiteMinutes > 0) {
        const title = `${projectTitle ? projectTitle + ': ' : ''}${deliverable.name} 取付`;

        try {
            const newItem: Omit<Item, 'id' | 'createdAt' | 'updatedAt' | 'statusUpdatedAt'> = {
                title: title,
                status: 'inbox',
                category: 'site',
                type: 'generic',
                weight: 1,
                interrupt: false,
                memo: `[Auto Generated]\nEstimated Site Work: ${deliverable.estimatedSiteMinutes} min`,
            };

            const newId = await JBWOSRepository.createItem(newItem);
            console.log('[StockIntegration] Created Inbox item (Site):', newId, title);

            createdStocks.push({
                id: newId,
                title: title,
                projectId: deliverable.id,
                estimatedMinutes: deliverable.estimatedSiteMinutes,
                status: 'open',
                createdAt: now
            });

        } catch (e) {
            console.error('Error creating site stock item:', e);
        }
    }

    return createdStocks;
}
