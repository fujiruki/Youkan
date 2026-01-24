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
    address_zip?: string;
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

    // Plugin Configuration
    config?: TenantConfig;
}

export interface TenantConfig {
    plugins: {
        manufacturing: boolean; // 製造業向け機能
        tategu: boolean;       // 建具エディタ (Requires manufacturing)
        [key: string]: boolean;
    };
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
    type?: 'user' | 'proprietor' | 'company';
    company_name?: string;
}
