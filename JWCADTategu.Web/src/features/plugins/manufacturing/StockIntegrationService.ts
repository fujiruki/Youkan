import { Deliverable } from './types';
import { JBWOSRepository } from '../../core/jbwos/repositories/JBWOSRepository';
import { Item } from '../../core/jbwos/types';

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
                // Link to Deliverable
                doorId: String(deliverable.id),
                focusOrder: 0,
                isEngaged: false
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
                doorId: String(deliverable.id),
                focusOrder: 0,
                isEngaged: false
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

/**
 * [NEW] Sync updates from Door (Deliverable) to JBWOS Tasks
 */
export async function syncDeliverableChanges(
    deliverable: Deliverable,
    projectTitle?: string
): Promise<void> {
    try {
        // 1. Find existing tasks linked to this door
        // We assume we stored doorId as string in the Item
        console.log(`[StockIntegration] Syncing Door ID: ${deliverable.id}, Name: ${deliverable.name}, Proj: ${projectTitle}`);
        const relatedItems = await JBWOSRepository.getItemsBySourceId(String(deliverable.id));
        console.log(`[StockIntegration] Found ${relatedItems.length} related items.`);

        if (relatedItems.length === 0) {
            console.log('[StockIntegration] No related items found. Auto-creating tasks (Branch B).');
            // Auto-create tasks because they are missing (First Save or deleted)
            await syncStockFromDeliverable(deliverable, projectTitle);
            return;
        }

        // 2. Update each related item (Branch A)
        for (const item of relatedItems) {
            const updates: Partial<Item> = {};
            let hasChanges = false;

            console.log(`[StockIntegration] Check Item ${item.id} (${item.title}), Category: ${item.category}`);

            // Name Sync Logic
            // We usually append "製作" or "取付". We should preserve the suffix if possible.
            // Heuristic: Replace the *start* of the title if it matches the old name?
            // Safer: Re-generate title based on logic?
            // "Project: DoorName 製作"

            // Simple Logic: If item is 'work' category, assume it's "Manufacturing"
            // If we want exact title sync, we need to know the pattern.
            // For now, let's just update the "Base Name" part or Append?
            // Actually, simplest is to Re-generate the title exactly as we create it.
            if (item.category === 'work') {
                const newTitle = `${projectTitle ? projectTitle + ': ' : ''}${deliverable.name} 製作`;
                console.log(`[StockIntegration] Title Check: Cur='${item.title}' New='${newTitle}'`);
                if (item.title !== newTitle) {
                    updates.title = newTitle;
                    hasChanges = true;
                }

                // Estimate Sync
                if (deliverable.estimatedWorkMinutes > 0 && item.estimatedMinutes !== deliverable.estimatedWorkMinutes) {
                    updates.estimatedMinutes = deliverable.estimatedWorkMinutes;
                    hasChanges = true;
                }
            } else if (item.category === 'site') {
                const newTitle = `${projectTitle ? projectTitle + ': ' : ''}${deliverable.name} 取付`;
                if (item.title !== newTitle) {
                    updates.title = newTitle;
                    hasChanges = true;
                }
                if (deliverable.estimatedSiteMinutes > 0 && item.estimatedMinutes !== deliverable.estimatedSiteMinutes) {
                    updates.estimatedMinutes = deliverable.estimatedSiteMinutes;
                    hasChanges = true;
                }
            }

            if (hasChanges) {
                console.log(`[Sync] Updating Item ${item.id}`, updates);
                try {
                    await JBWOSRepository.updateItemGeneric(item.id, updates);
                    console.log(`[Sync] Update Success`);
                } catch (err) {
                    console.error(`[Sync] Update Failed`, err);
                }
            } else {
                console.log(`[Sync] No changes detected for Item ${item.id}`);
            }
        }

    } catch (e) {
        console.error('[StockIntegration] Failed to sync deliverable changes:', e);
    }
}
