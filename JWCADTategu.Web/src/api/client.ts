import { JudgableItem, Member, Assignee } from '../features/core/jbwos/types';

// src/api/client.ts

// Development uses Vite proxy (/api -> localhost:8000)
// Production uses index.php with PATH_INFO.
// FIX: Use absolute path calculation to prevent 404 when app is at sub-path (e.g. /today)
const getApiBase = () => {
    if (import.meta.env.DEV) return '/api';

    // Production: Force absolute path
    // Assuming deployed at /contents/TateguDesignStudio/
    const deployPath = '/contents/TateguDesignStudio/';

    // Check if we are actually under this path to be safe, or just force it.
    // Given the deployment script targeting this path, forcing it is safest for now.
    return `${deployPath}backend/index.php`;
};

const API_BASE = getApiBase();

export class ApiClient {
    private static errorHandler: ((error: Error, method: string, path: string) => void) | null = null;

    // グローバルエラーハンドラの登録
    public static setErrorHandler(handler: (error: Error, method: string, path: string) => void) {
        this.errorHandler = handler;
    }

    // Debug Mode Check
    private static isDebug(): boolean {
        return import.meta.env.DEV || !!localStorage.getItem('JBWOS_DEBUG');
    }

    private static log(groupName: string, data: any, isError = false) {
        if (!this.isDebug()) return;

        const style = isError
            ? 'background: #fee; color: #c00; font-weight: bold; padding: 2px 4px; border-radius: 2px;'
            : 'background: #eef; color: #00c; font-weight: bold; padding: 2px 4px; border-radius: 2px;';

        console.groupCollapsed(`%cAPI ${groupName}`, style);
        console.log('Timestamp:', new Date().toISOString());
        console.table(data); // Clearer data visualization
        console.groupEnd();
    }

    public static async request<T>(method: string, path: string, body?: any, silent = false): Promise<T> {
        const headers: HeadersInit = {
            'Content-Type': 'application/json',
        };

        // [New] Auth Injection
        const token = localStorage.getItem('jbwos_token'); // Simple retrieval or use AuthService
        if (token) {
            (headers as any)['Authorization'] = `Bearer ${token}`;
        }

        // Server compatibility: Use X-HTTP-Method-Override for PUT/DELETE
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

        const startTime = performance.now();
        try {
            // [Modification] WAF avoidance: Do not append token to URL. Use Header only.
            const url = `${API_BASE}${path}`;

            const response = await fetch(url, config);
            const duration = Math.round(performance.now() - startTime);

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                const errorMessage = errorData.message || `API Error: ${response.status}`;

                this.log(`ERROR ${method} ${path} (${duration}ms)`, {
                    status: response.status,
                    url: `${API_BASE}${path}`,
                    requestBody: body,
                    error: errorData
                }, true);

                throw new Error(errorMessage);
            }

            // Handle 204 No Content
            if (response.status === 204) {
                this.log(`SUCCESS ${method} ${path} (${duration}ms)`, {
                    status: 204,
                    url: `${API_BASE}${path}`,
                    requestBody: body,
                    response: '(No Content)'
                });
                return {} as T;
            }

            const data = await response.json();
            this.log(`SUCCESS ${method} ${path} (${duration}ms)`, {
                status: response.status,
                url: `${API_BASE}${path}`,
                requestBody: body,
                response: data
            });
            return data;

        } catch (error) {
            const duration = Math.round(performance.now() - startTime);
            this.log(`FAIL ${method} ${path} (${duration}ms)`, {
                url: `${API_BASE}${path}`,
                requestBody: body,
                error: error
            }, true);

            // Call global error handler if registered
            if (this.errorHandler && error instanceof Error && !silent) {
                this.errorHandler(error, method, path);
            }

            throw error;
        }
    }

    public static async getAllItems(options?: { scope?: 'aggregated' | 'dashboard' | 'personal' | 'company', parentId?: string, project_id?: string, show_archived?: boolean, show_trash?: boolean }): Promise<JudgableItem[]> {
        const params = new URLSearchParams();
        if (options?.scope) params.append('scope', options.scope);
        if (options?.parentId) params.append('parent_id', options.parentId);
        if (options?.project_id) params.append('project_id', options.project_id);
        if (options?.show_archived) params.append('show_archived', '1');
        if (options?.show_trash) params.append('show_trash', '1');

        const query = params.toString() ? `?${params.toString()}` : '';
        return this.request<JudgableItem[]>('GET', `/items${query}`);
    }

    public static async archiveItem(id: string): Promise<{ success: boolean }> {
        return this.request<{ success: boolean }>('POST', `/items/${id}/archive`);
    }

    public static async trashItem(id: string): Promise<{ success: boolean }> {
        return this.request<{ success: boolean }>('POST', `/items/${id}/trash`);
    }

    public static async restoreItem(id: string): Promise<{ success: boolean }> {
        return this.request<{ success: boolean }>('POST', `/items/${id}/restore`);
    }

    public static async destroyItem(id: string): Promise<{ success: boolean }> {
        return this.request<{ success: boolean }>('POST', `/items/${id}/destroy`);
    }

    public static async createItem(item: Partial<JudgableItem>): Promise<{ id: string; success: boolean }> {
        console.log('[ApiClient] Creating item:', item.title);
        return this.request<{ id: string; success: boolean }>('POST', '/items', item);
    }

    public static async updateItem(id: string, updates: Partial<JudgableItem>): Promise<{ success: boolean }> {
        console.log(`[ApiClient] Updating item ${id}:`, updates);
        return this.request<{ success: boolean }>('PUT', `/items/${id}`, updates);
    }

    public static async deleteItem(id: string): Promise<{ success: boolean }> {
        return this.request<{ success: boolean }>('DELETE', `/items/${id}`);
    }

    public static async clearAllItems(): Promise<{ success: boolean; count: number }> {
        return this.request<{ success: boolean; count: number }>('POST', '/items/clear_all');
    }

    public static async getProjects(options?: { scope?: 'personal' | 'company' | 'dashboard' | 'aggregated' }): Promise<any[]> {
        const query = options?.scope ? `?scope=${options.scope}` : '';
        return this.request('GET', `/projects${query}`);
    }

    public static async getJoinedTenants(): Promise<{ id: string; name: string; role: string }[]> {
        // /auth/me returns joinedTenants list
        const res = await this.request<{ joinedTenants: { id: string; name: string; role: string }[] }>('GET', '/auth/me');
        return res.joinedTenants || [];
    }

    // --- Phase 2: Decision API ---
    public static async resolveDecision(id: string, decision: 'yes' | 'hold' | 'no', note?: string, rdd?: any): Promise<{ success: boolean; new_status: string }> {
        return this.request('POST', `/decision/${id}/resolve`, { decision, note, rdd });
    }

    // --- Phase 2: Today API ---
    public static async getTodayView(projectId?: string): Promise<any> { // Replace 'any' with proper type later
        const query = projectId ? `?project_id=${projectId}` : '';
        return this.request('GET', `/today${query}`, undefined, true);
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

    // Items Backup (User's personal items as JSON)
    public static getItemsBackupUrl(): string {
        const token = localStorage.getItem('jbwos_token');
        const tokenQuery = token ? `?token=${encodeURIComponent(token)}` : '';
        return `${API_BASE}/items-backup${tokenQuery}`;
    }

    public static async restoreItems(file: File): Promise<{ success: boolean; imported: number; message: string }> {
        const formData = new FormData();
        formData.append('backup_file', file);

        const token = localStorage.getItem('jbwos_token');

        const headers: HeadersInit = {};
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        const response = await fetch(`${API_BASE}/items-restore`, { // Query param removed
            method: 'POST',
            headers, // Header added
            body: formData,
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `API Error: ${response.status}`);
        }

        return response.json();
    }

    // --- GDB Shelf API ---
    public static async getGdbShelf(projectId?: string): Promise<{ active: JudgableItem[]; preparation: JudgableItem[]; intent: JudgableItem[]; history: JudgableItem[] }> {
        const query = projectId ? `?project_id=${projectId}` : '';
        return this.request('GET', `/gdb/shelf${query}`);
    }

    // --- Calendar Load API ---
    public static async getCalendarLoad(year: number, month: number): Promise<any[]> {
        return this.request('GET', `/calendar/load?year=${year}&month=${month}`);
    }

    // --- Phase 2: Side Memo API ---
    public static async getMemos(): Promise<any[]> {
        return this.request('GET', '/memos', undefined, true);
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
        return this.request('GET', '/health', undefined, true);
    }

    // --- User API ---
    public static async getUserProfile(): Promise<{ id: string; email: string; display_name: string; birthday: string; daily_capacity_minutes: number; non_working_hours: any; preferences: any }> {
        return this.request('GET', '/user/profile');
    }

    public static async updateUserProfile(data: { display_name?: string; birthday?: string; daily_capacity_minutes?: number; non_working_hours?: any; preferences?: any }): Promise<{ success: boolean }> {
        return this.request('PUT', '/user/profile', data);
    }

    public static async changePassword(currentPassword: string, newPassword: string): Promise<{ success: boolean; message?: string }> {
        return this.request('PUT', '/user/password', { current_password: currentPassword, new_password: newPassword });
    }

    // --- Member Configuration API ---
    public static async getMembers(): Promise<Member[]> {
        return this.request('GET', '/members');
    }

    public static async updateMember(id: string, updates: Partial<Member>): Promise<{ success: boolean }> {
        // Snake case conversion happens in backend or payload construction?
        const payload: any = {};
        if (updates.isCore !== undefined) payload.is_core = updates.isCore;
        if (updates.dailyCapacityMinutes !== undefined) payload.daily_capacity_minutes = updates.dailyCapacityMinutes;
        if (updates.role !== undefined) payload.role = updates.role;

        return this.request('PUT', `/tenant/members/${id}`, payload);
    }

    public static async inviteMember(email: string, role: 'user' | 'admin' | 'owner' = 'user', name?: string): Promise<{ success: boolean; userId: string; message: string }> {
        return this.request('POST', '/tenant/members', { email, role, name });
    }

    public static async removeMember(id: string): Promise<{ success: boolean }> {
        return this.request('DELETE', `/tenant/members/${id}`);
    }

    // --- Assignee API (Phase 9) ---
    public static async getAssignees(): Promise<Assignee[]> {
        return this.request('GET', '/assignees');
    }

    public static async createAssignee(data: Partial<Assignee>): Promise<{ success: boolean; id: string }> {
        return this.request('POST', '/assignees', data);
    }

    public static async updateAssignee(id: string, updates: Partial<Assignee>): Promise<{ success: boolean }> {
        return this.request('PUT', `/assignees/${id}`, updates);
    }

    public static async deleteAssignee(id: string): Promise<{ success: boolean }> {
        return this.request('DELETE', `/assignees/${id}`);
    }

    public static async getTenantInfo(): Promise<{ id: string; name: string; created_at: string; member_count: number }> {
        return this.request('GET', '/tenant/info'); // Relative to tenant context? No, API structure is usually /api/tenant/info?
        // TenantController routing:
        // If we are hitting /api/tenant/..., we need to check how routing works in index.php
        // index.php likely routes /tenant/* to TenantController using handleRequest with subpath.
        // If I call /info, it might be /api/tenant/info.
        // Let's verify route mapping in index.php or assume standard /tenant prefix if used there.
        // Wait, ApiClient base is /api or /index.php/api?
        // In index.php:
        // $uri = ...
        // if (strpos($uri, '/projects') === 0) ...
        // if (strpos($uri, '/tenant') === 0) { $controller = new TenantController(...); $controller->handleRequest($method, substr($uri, 7)); }
        // So /tenant/info -> handleRequest with /info.
    }

    // Correcting path assumption: The Client methods like `getMembers` call `/members`.
    // Does `getMembers` prepend `/tenant`?
    // Let's check `getMembers` implementation lines 287-288:
    // `return this.request('GET', '/members');`
    // Wait, if `ApiClient` uses `/api` base.
    // Call is `/api/members`.
    // index.php needs to route `/api/members`?
    // If index.php routes `/tenant` to TenantController, then Client must call `/tenant/members`.
    // Unless `/members` is a top-level route in index.php?
    // I need to check `index.php`.

    public static async updateTenantInfo(name: string): Promise<{ success: boolean }> {
        return this.request('PUT', '/tenant/info', { name });
    }

    // --- Manufacturing Plugin API (v23) ---
    public static async getManufacturingItem(itemId: string): Promise<any> {
        return this.request('GET', `/manufacturing/items?item_id=${itemId}`);
    }

    public static async updateManufacturingItem(itemId: string, data: any): Promise<{ success: boolean }> {
        return this.request('PUT', `/manufacturing/items?item_id=${itemId}`, data);
    }

    public static async getCompanyMembers(): Promise<any[]> {
        return this.request('GET', '/manufacturing/members');
    }

    public static async updateCompanyMember(id: string, updates: any): Promise<{ success: boolean }> {
        return this.request('PUT', `/manufacturing/members/${id}`, updates);
    }
}
