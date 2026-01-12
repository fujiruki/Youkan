import { JudgableItem } from '../jbwos-core/types';

// src/api/client.ts

const API_BASE = 'http://localhost:8000';

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
}
