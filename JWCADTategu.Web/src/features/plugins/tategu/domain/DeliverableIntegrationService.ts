import { Door, Project, db } from '../../../../db/db';
import { deliverableRepository } from '../../manufacturing/repository';
import { Deliverable } from '../../manufacturing/types';
import { calculateCost } from './EstimationService';

// [Workaround] Import from types.ts failing for some reason
type DeliverableCreateRequest = Omit<Deliverable, 'id' | 'createdAt' | 'updatedAt' | 'linkedItemId'>;
type DeliverableUpdateRequest = Partial<DeliverableCreateRequest>;

/**
 * Tategu Plugin (建具) と Manufacturing Plugin (成果物) の連携サービス
 * 建具データの作成・更新時に成果物データを同期します。
 */
export const DeliverableIntegrationService = {
    /**
     * 建具データから成果物を同期（作成または更新）する
     * @param door 建具データ
     * @param project プロジェクトデータ
     */
    async syncDoorToDeliverable(door: Door, project: Project): Promise<void> {
        if (!project.id) return;

        // 建具の原価・時間を計算
        // settingsがない場合はデフォルト設定か0になる
        const estimation = project.settings
            ? calculateCost(door.dimensions, project.settings)
            : { totalCost: 0, unitPrice: 0, items: [] };

        // 成果物データの構築
        // 時間: Door.manHours (hour) -> minutes. Default 2 hours per item.
        const manHoursPerItem = door.manHours || 2.0;
        const totalWorkMinutes = Math.floor(manHoursPerItem * 60 * door.count);

        // 原価: EstimationServiceのtotalCostは全数量（count）分の合計
        const totalMaterialCost = estimation.totalCost;

        // 労務費: 仮に時間単価 3000円 (Default) or Project setting
        // TODO: Fetch from Project Settings if available (e.g. project.defaultLaborRate)
        const laborRate = 3000;
        const totalLaborCost = Math.floor(manHoursPerItem * door.count * laborRate);

        // その他経費: 材料費の10% (仮)
        const otherCost = Math.floor(totalMaterialCost * 0.1);

        const deliverableData: any = {
            projectId: String(project.id),
            name: door.name,
            type: 'product', // 建具は製品

            // Cost Details [NEW]
            laborRate: laborRate,
            materialCost: totalMaterialCost,
            otherCost: otherCost,
            cost: totalMaterialCost + totalLaborCost + otherCost,
            price: estimation.unitPrice || 0, // 売価 (Correction: unitPrice from EstimationResult)

            // Time Management [NEW]
            estimatedWorkMinutes: totalWorkMinutes,
            estimatedSiteMinutes: 0, // Default 0
            actualWorkMinutes: 0,    // Default 0

            // 必須プロパティ
            requiresSiteInstallation: false,

            status: 'pending',
            pluginData: {
                sourcePlugin: 'tategu',
                doorId: door.id,
                doorTag: door.tag
            }
        };

        try {
            if (door.deliverableId) {
                // 更新
                await deliverableRepository.update(door.deliverableId, deliverableData as DeliverableUpdateRequest);
                console.log(`Updated deliverable ${door.deliverableId} for door ${door.tag}`);
            } else {
                // 新規作成
                const result = await deliverableRepository.create(deliverableData as DeliverableCreateRequest);
                if (result && result.id) {
                    const newDeliverableId = result.id;

                    // Door側にdeliverableIdを保存
                    if (door.id) {
                        await db.doors.update(door.id, { deliverableId: newDeliverableId });
                        console.log(`Created deliverable ${newDeliverableId} for door ${door.tag}`);
                    }

                    // [JBWOS Enterprise] Stock (Shop Floor) への追加
                    // 直接Inboxのタスクにするのではなく、未割当ジョブとしてプールする
                    const deliverableForTask = { ...deliverableData, id: newDeliverableId } as Deliverable;
                    import('../../manufacturing/StockIntegrationService').then(({ syncStockFromDeliverable }) => {
                        syncStockFromDeliverable(deliverableForTask, project.name);
                    });
                }
            }
        } catch (error) {
            console.error('Failed to sync deliverable:', error);
            // 同期エラーについてはログのみで継続
        }
    }
};
