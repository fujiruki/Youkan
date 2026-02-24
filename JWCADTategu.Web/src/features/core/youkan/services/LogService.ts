import { ApiClient } from '../../../../api/client';

export class LogService {
    public static async logLife(data: { id?: string; category?: string; content?: string }): Promise<{ success: boolean; id: string }> {
        return ApiClient.request('POST', '/logs/life', data);
    }

    public static async logExecution(data: { item_id?: string; project_id?: string; duration_minutes?: number; content?: string }): Promise<{ success: boolean; id: string }> {
        return ApiClient.request('POST', '/logs/execution', data);
    }

    public static async getHistorySummary(month: string): Promise<any> {
        return ApiClient.request('GET', `/history/summary?month=${month}`);
    }

    public static async getHistoryTimeline(limit = 100): Promise<any[]> {
        return ApiClient.request('GET', `/history/timeline?limit=${limit}`);
    }
}
