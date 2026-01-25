import { ILifeLogRepository } from '../domain/ILifeLogRepository';
import { ApiClient } from '../../../../api/client';

export class LifeLogRepository implements ILifeLogRepository {
    async getCheckedItems(): Promise<Record<string, boolean>> {
        // API returns map of item_id -> boolean (or just list, but we map it)
        // Controller returns object { "id1": true, ... }
        return ApiClient.request<Record<string, boolean>>('GET', '/life/today');
    }

    async checkItem(itemId: string): Promise<{ checked: boolean }> {
        return ApiClient.request<{ success: boolean, checked: boolean }>('POST', `/life/${itemId}/check`);
    }
}
