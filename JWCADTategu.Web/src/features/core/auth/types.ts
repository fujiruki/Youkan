export interface AuthUser {
    id: string;
    name: string;
    email: string;
}

export interface Tenant {
    id: string;
    name: string;
    role: string;
}

export interface JbwosTenant extends Tenant {
    // Basic Info
    address?: string;
    phone?: string;
    invoiceNumber?: string; // T+13桁

    // Commerce
    bankInfo?: {
        bankName: string;
        accountType: string;
        accountNumber: string;
        accountHolder: string;
    };

    // Settings
    closingDate?: number; // 締め日
}

export interface AuthResponse {
    token: string;
    user: AuthUser;
    tenant: Tenant;
}

export interface LoginCredentials {
    email: string;
    password: string;
}

export interface RegisterCredentials {
    name: string;
    email: string;
    password: string;
}
