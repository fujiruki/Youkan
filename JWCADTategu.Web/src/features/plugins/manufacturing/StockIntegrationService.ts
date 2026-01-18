/**
 * Manufacturing Plugin - Stock Integration Service (Enterprise v6)
 * 
 * 成果物（Deliverable）からJBWOS Stock（未割当ジョブ）を作成するサービス
 * JBWOS Enterpriseアーキテクチャに基づき、Inboxへの直接投入ではなく
 * Stockプールへの「一時保管」を行う。
 */

import { Deliverable } from './types';

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
 */
export async function syncStockFromDeliverable(
    deliverable: Deliverable,
    projectTitle?: string
): Promise<StockItem[]> {
    const createdStocks: StockItem[] = [];
    const now = Date.now();

    // 1. 製作 Job
    if (deliverable.estimatedWorkMinutes > 0) {
        const stockData = {
            id: crypto.randomUUID(),
            title: `${projectTitle ? projectTitle + ': ' : ''}${deliverable.name} 製作`,
            project_id: deliverable.id, // Link to Deliverable ID
            estimated_minutes: deliverable.estimatedWorkMinutes,
            due_date: null, // 将来的にDeliverableの納期を使用
            status: 'open',
            created_at: now
        };

        try {
            const response = await fetch(API_BASE, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(stockData) // PHP側はスネークケース期待、JSONデコード時に対応するか、キーを合わせる
            });

            if (response.ok) {
                // PHPからのレスポンスにはIDが含まれているはず
                const resJson = await response.json();
                if (resJson.status === 'success') {
                    createdStocks.push({
                        ...stockData,
                        id: resJson.id || stockData.id,
                        projectId: stockData.project_id,
                        estimatedMinutes: stockData.estimated_minutes,
                        createdAt: stockData.created_at
                    } as any);
                }
            } else {
                console.error('Failed to create stock:', await response.text());
            }
        } catch (e) {
            console.error('Error creating stock:', e);
        }
    }

    // 2. 取付 Job (Optional)
    if (deliverable.requiresSiteInstallation && deliverable.estimatedSiteMinutes > 0) {
        const stockData = {
            id: crypto.randomUUID(),
            title: `${projectTitle ? projectTitle + ': ' : ''}${deliverable.name} 取付`,
            project_id: deliverable.id,
            estimated_minutes: deliverable.estimatedSiteMinutes,
            due_date: null,
            status: 'open',
            created_at: now
        };

        try {
            await fetch(API_BASE, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(stockData)
            });
            createdStocks.push(stockData as any);
        } catch (e) {
            console.error('Error creating site stock:', e);
        }
    }

    return createdStocks;
}
