/**
 * Manufacturing Plugin - Task Generation Service
 * 
 * 成果物（Deliverable）からJBWOSタスクを自動生成するサービス
 */

import { Deliverable } from './types';
import { Item } from '../../core/jbwos/types';

const API_BASE = '/api/items';

/**
 * 成果物からJBWOSタスクを生成
 * 
 * 生成タスク:
 * - 製作物（product）の場合: 「[成果物名] 製作」タスク
 * - 現場作業ありの場合: 「[成果物名] 取付」タスク（追加）
 */
export async function generateTasksFromDeliverable(
    deliverable: Deliverable,
    projectTitle?: string
): Promise<Item[]> {
    const createdItems: Item[] = [];
    const now = Date.now();

    // 1. 製作タスク（製作時間がある場合）
    if (deliverable.estimatedWorkMinutes > 0) {
        const workTask: Partial<Item> = {
            title: `${deliverable.name} 製作`,
            status: 'inbox',
            statusUpdatedAt: now,
            projectId: deliverable.projectId,
            projectTitle: projectTitle,
            estimatedMinutes: deliverable.estimatedWorkMinutes,
            weight: getWeightFromMinutes(deliverable.estimatedWorkMinutes),
            interrupt: false,
            memo: `成果物: ${deliverable.name}`,
            createdAt: now,
            updatedAt: now
        };

        const response = await fetch(API_BASE, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(workTask)
        });

        if (response.ok) {
            const created = await response.json();
            createdItems.push(created);
        }
    }

    // 2. 取付タスク（現場時間がある場合）
    if (deliverable.requiresSiteInstallation && deliverable.estimatedSiteMinutes > 0) {
        const siteTask: Partial<Item> = {
            title: `${deliverable.name} 取付`,
            status: 'inbox',
            statusUpdatedAt: now,
            projectId: deliverable.projectId,
            projectTitle: projectTitle,
            estimatedMinutes: deliverable.estimatedSiteMinutes,
            weight: getWeightFromMinutes(deliverable.estimatedSiteMinutes),
            interrupt: false,
            memo: `成果物: ${deliverable.name}（現場作業）`,
            createdAt: now,
            updatedAt: now
        };

        const response = await fetch(API_BASE, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(siteTask)
        });

        if (response.ok) {
            const created = await response.json();
            createdItems.push(created);
        }
    }

    return createdItems;
}

/**
 * 時間からWeight（重さ）を自動決定
 * - 60分以下: Light (1)
 * - 180分以下: Medium (2)
 * - 180分超: Heavy (3)
 */
function getWeightFromMinutes(minutes: number): 1 | 2 | 3 {
    if (minutes <= 60) return 1;
    if (minutes <= 180) return 2;
    return 3;
}

/**
 * 成果物に紐づくタスクを削除
 * 成果物削除時に呼び出す
 */
export async function deleteTasksForDeliverable(deliverableId: string): Promise<void> {
    // TODO: linked_item_idを使ってタスクを特定して削除
    // 現時点ではlinked_item_idはDeliverable側に持つ設計のため、
    // タスクからの逆引きは別途実装が必要
    console.log('[TaskGenerationService] deleteTasksForDeliverable:', deliverableId);
}
