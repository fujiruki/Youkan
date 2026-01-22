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

export interface AuthResponse {
    token: string;
    user: AuthUser;
    tenant: Tenant;
}

export interface LoginCredentials {
    email: string;
    password: string;
}
