import { JudgableItem } from '../features/jbwos/types';

// src/api/client.ts

const API_BASE = '/api';

export class ApiClient {
    private static async request<T>(method: string, path: string, body?: any): Promise<T> {
        const headers: HeadersInit = {
            'Content-Type': 'application/json',
        };

        const config: RequestInit = {
            method,
            headers,
            body: body ? JSON.stringify(body) : undefined,
        };

        try {
            const response = await fetch(`${API_BASE}${path}`, config);

            if (!response.ok) {
                // Handle HTTP errors
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || `API Error: ${response.status}`);
            }

            // Handle 204 No Content
            if (response.status === 204) {
                return {} as T;
            }

            return await response.json();
        } catch (error) {
            console.error(`API Request Failed: ${method} ${path}`, error);
            throw error;
        }
    }

    public static async getAllItems(): Promise<JudgableItem[]> {
        return this.request<JudgableItem[]>('GET', '/items');
    }

    public static async createItem(item: Partial<JudgableItem>): Promise<{ id: string; success: boolean }> {
        return this.request<{ id: string; success: boolean }>('POST', '/items', item);
    }

    public static async updateItem(id: string, updates: Partial<JudgableItem>): Promise<{ success: boolean }> {
        return this.request<{ success: boolean }>('PUT', `/items/${id}`, updates);
    }

    public static async deleteItem(id: string): Promise<{ success: boolean }> {
        return this.request<{ success: boolean }>('DELETE', `/items/${id}`);
    }

    // --- Phase 2: Decision API ---
    public static async resolveDecision(id: string, decision: 'yes' | 'hold' | 'no', note?: string, rdd?: any): Promise<{ success: boolean; new_status: string }> {
        return this.request('POST', `/decision/${id}/resolve`, { decision, note, rdd });
    }

    // --- Phase 2: Today API ---
    public static async getTodayView(): Promise<any> { // Replace 'any' with proper type later
        return this.request('GET', '/today');
    }

    public static async commitToToday(id: string): Promise<{ success: boolean }> {
        return this.request('POST', '/today/commit', { id });
    }

    public static async completeItem(id: string): Promise<{ success: boolean }> {
        return this.request('POST', '/today/complete', { id });
    }



    // --- Phase 3: Life & Execution API ---
    public static async checkLife(id: string): Promise<{ success: boolean; id: string }> {
        return this.request('POST', `/life/${id}/check`);
    }

    public static async startExecution(id: string): Promise<{ success: boolean; action: string }> {
        return this.request('POST', `/execution/${id}/start`);
    }

    public static async pauseExecution(id: string): Promise<{ success: boolean; action: string }> {
        return this.request('POST', `/execution/${id}/pause`);
    }

    public static async getHistory(): Promise<any[]> {
        return this.request('GET', '/history');
    }

    // --- Phase 2: GDB API ---
    public static async getGdbShelf(): Promise<any> { // Replace 'any' with proper type
        return this.request('GET', '/gdb');
    }

    // --- Phase 2: Side Memo API ---
    public static async getMemos(): Promise<any[]> {
        return this.request('GET', '/memos');
    }

    public static async createMemo(content: string): Promise<{ id: string; content: string }> {
        return this.request('POST', '/memos', { content });
    }

    public static async deleteMemo(id: string): Promise<{ success: boolean }> {
        return this.request('DELETE', `/memo/${id}`);
    }

    public static async moveMemoToInbox(id: string): Promise<{ success: boolean }> {
        return this.request('POST', `/memo/${id}/move-to-inbox`);
    }
}
