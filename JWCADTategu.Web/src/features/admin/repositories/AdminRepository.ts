import { ApiClient } from '../../../api/client';

export interface AdminUser {
    id: string;
    email: string;
    display_name: string;
    created_at: string;
    memberships: string | null;
}

export interface AdminTenant {
    id: string;
    name: string;
    created_at: string;
    member_count: number;
    representative_name?: string;
    representative_email?: string;
    owner_id?: string;
}

export const AdminRepository = {
    async getUsers(): Promise<AdminUser[]> {
        const res = await ApiClient.request<{ count: number; users: AdminUser[] }>('GET', '/debug/users');
        return res.users;
    },

    async getTenants(): Promise<AdminTenant[]> {
        const res = await ApiClient.request<{ count: number; tenants: AdminTenant[] }>('GET', '/debug/tenants');
        return res.tenants;
    },

    async deleteUser(userId: string): Promise<void> {
        await ApiClient.request('DELETE', `/debug/users/${userId}`);
    },

    async deleteTenant(tenantId: string): Promise<void> {
        // Note: DELETE /debug/tenants/{id} endpoint needs to be implemented in DebugController first?
        // Checking DebugController: It does NOT have DELETE /debug/tenants/{id}. 
        // Only GET /debug/tenants is implemented.
        // We probably need to add DELETE implementation in DebugController as well.
        await ApiClient.request('DELETE', `/debug/tenants/${tenantId}`);
    },


    async resetPassword(userId: string, newPassword: string): Promise<void> {
        await ApiClient.request('PUT', `/debug/users/${userId}/password`, {
            newPassword
        });
    }
};
