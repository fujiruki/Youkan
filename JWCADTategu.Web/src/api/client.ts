import { JudgableItem } from '../features/jbwos/types';

// src/api/client.ts

// Development uses Vite proxy (/api -> localhost:8000)
// Production uses index.php with PATH_INFO.
// FIX: Use absolute path calculation to prevent 404 when app is at sub-path (e.g. /today)
const getApiBase = () => {
    if (import.meta.env.DEV) return '/api';

    // Production: Calculate path to index.php valid from anywhere
    // If loc is .../index.php/today, we want .../index.php
    // If loc is .../TateguDesignStudio/, we want .../TateguDesignStudio/index.php

    const pathname = window.location.pathname;

    // Case 1: Already inside index.php
    if (pathname.includes('/index.php')) {
        return pathname.split('/index.php')[0] + '/index.php';
    }

    // Case 2: At Root (index.html), so index.php is sibling
    // Remove trailing slash if exists
    const root = pathname.replace(/\/$/, '');
    return `${root}/index.php`;
};

const API_BASE = getApiBase();

export class ApiClient {
    private static errorHandler: ((error: Error, method: string, path: string) => void) | null = null;

    // グローバルエラーハンドラの登録
    public static setErrorHandler(handler: (error: Error, method: string, path: string) => void) {
        this.errorHandler = handler;
    }

    private static async request<T>(method: string, path: string, body?: any): Promise<T> {
        const headers: HeadersInit = {
            'Content-Type': 'application/json',
        };

        // Server compatibility: Use X-HTTP-Method-Override for PUT/DELETE
        // Some shared hosts block DELETE/PUT methods.
        let actualMethod = method;
        if (method === 'PUT' || method === 'DELETE') {
            headers['X-HTTP-Method-Override'] = method;
            actualMethod = 'POST';
        }

        const config: RequestInit = {
            method: actualMethod,
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

            // Call global error handler if registered
            if (this.errorHandler && error instanceof Error) {
                this.errorHandler(error, method, path);
            }

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

    // --- Backup & Restore ---
    public static async restoreDatabase(file: File): Promise<void> {
        const formData = new FormData();
        formData.append('backup_file', file);

        // Use raw fetch for FormData since wrapper expects JSON body usually
        // But let's see current request implementation.
        // It sets Content-Type: application/json automatically.
        // We need to bypass that for FormData.

        // Custom request for multipart (Fetch API directly)
        const response = await fetch(`${API_BASE}/restore`, {
            method: 'POST',
            body: formData,
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || `API Error: ${response.status}`);
        }
    }

    // Helper for download
    public static getBackupUrl(): string {
        return `${API_BASE}/backup`;
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

    // --- System API ---
    public static async getHealth(): Promise<any> {
        return this.request('GET', '/health');
    }
}
